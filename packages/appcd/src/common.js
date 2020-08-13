import appcdLogger from 'appcd-logger';
import Client from 'appcd-client';
import fs from 'fs';
import globalPrefix from 'global-prefix';
import path from 'path';
import Table from 'cli-table3';

import { ansi } from 'cli-kit';
import { expandPath } from 'appcd-path';
import { isFile } from 'appcd-fs';
import { loadConfig as appcdLoadConfig } from 'appcd-core';
import { sleep } from 'appcd-util';
import { spawn } from 'child_process';

const { error, log } = appcdLogger('appcd:common');
const { highlight } = appcdLogger.styles;
const { cyan, red } = appcdLogger.chalk;

let appcdVersion = null;

/**
 * Ensures that the current process is not being run as sudo as that would likely lead to file
 * permission issues.
 *
 * @param {Console} out - A console instance to write output with.
 */
export function assertNotSudo(out = console) {
	const sudoUID = process.getuid && parseInt(process.env.SUDO_UID);
	if (sudoUID) {
		const uid = process.getuid();
		if (sudoUID !== uid) {
			out.error(red(`Error: Command is being run as a different user (${uid}) than expected (${sudoUID})\n`));
			out.error('Running this command as a different user will lead to file permission issues.');
			out.error('Please re-run this command without "sudo".');
			process.exit(9);
		}
	}
}

/**
 * Highlights the difference between two version numbers.
 *
 * @param {String} fromVer - The reference version number.
 * @param {String} toVer - The version to colorize.
 * @returns {String}
 */
export function colorizeVersionDelta(fromVer, toVer) {
	if (!fromVer) {
		return cyan(toVer);
	}

	const version = [];

	let [ from, fromTag ] = fromVer.split(/-(.+)/);
	from = from.replace(/[^.\d]/g, '').split('.').map(x => parseInt(x));

	let [ to, toTag ] = toVer.split(/-(.+)/);
	const toMatch = to.match(/^([^\d]+)?(.+)$/);
	to = (toMatch ? toMatch[2] : to).split('.').map(x => parseInt(x));

	const tag = () => {
		if (!toTag) {
			return '';
		}
		const toNum = toTag.match(/\d+$/);
		const fromNum = fromTag && fromTag.match(/\d+$/);
		if (fromNum && parseInt(fromNum[0]) >= parseInt(toNum)) {
			return `-${toTag}`;
		} else {
			return cyan(`-${toTag}`);
		}
	};

	while (to.length) {
		if (to[0] > from[0]) {
			if (version.length) {
				return (toMatch && toMatch[1] || '') + version.concat(cyan(to.join('.') + tag())).join('.');
			}
			return cyan((toMatch && toMatch[1] || '') + to.join('.') + tag());
		}
		version.push(to.shift());
		from.shift();
	}

	return (toMatch && toMatch[1] || '') + version.join('.') + tag();
}

/**
 * Makes a request to the Appc Daemon.
 *
 * @param {Config} cfg - A config instance.
 * @param {String} path - The path to request.
 * @param {Object} [data] - The data to send along with the request.
 * @param {String} [type] - The request type. (i.e. 'call', 'subscribe', 'unsubscribe')
 * @returns {Client}
 */
export function createRequest(cfg, path, data, type) {
	const client = new Client({
		host: cfg.get('server.host'),
		port: cfg.get('server.post'),
		userAgent: `appcd/${appcdVersion}`
	});

	log('Creating request: %s', highlight(`${type || 'call'}://${client.host}:${client.port}${path}`));
	const request = client
		.request({ path, data, type })
		.once('error', err => {
			if (err.code !== 'ECONNREFUSED') {
				process
					.removeListener('SIGINT', disconnect)
					.removeListener('SIGTERM', disconnect);
			}
		})
		.once('finish', () => client.disconnect());

	function disconnect() {
		client.disconnect();
		process.exit(0);
	}

	process
		.on('SIGINT', disconnect)
		.on('SIGTERM', disconnect);

	return { client, request };
}

/**
 * Creates a table with default styles and padding.
 *
 * @param {Array.<String>} head - One or more headings.
 * @param {Number} [indent] - The number of spaces to indent the table.
 * @returns {Table}
 */
export function createTable(head, indent = 0) {
	return new Table({
		chars: {
			bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
			left: ' '.repeat(indent), 'left-mid': '',
			mid: '', 'mid-mid': '', middle: '  ',
			right: '', 'right-mid': '',
			top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
		},
		head: Array.isArray(head) ? head.map(ansi.toUpperCase) : head,
		style: {
			head: [],
			'padding-left': 0,
			'padding-right': 0
		}
	});
}

/**
 * Formats an error.
 *
 * @param {Error} err - The error object.
 * @param {Boolean} json - Return the error as JSON.
 * @return {String}
 */
export function formatError(err, json) {
	if (json) {
		return JSON.stringify({
			error: {
				code: err.code,
				message: err.message
			}
		}, null, 2);
	}
	return red(`Error: ${err.message}`);
}

/**
 * Retrieves the Appc Daemon version.
 *
 * @returns {String}
 */
export function getAppcdVersion() {
	if (!appcdVersion) {
		appcdVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
	}
	return appcdVersion;
}

/**
 * Reads the appcd-core package.json and gets the Node.js version it requires.
 *
 * @returns {?String}
 */
export function getAppcdCoreNodeVersion() {
	const corePkgJson = JSON.parse(fs.readFileSync(require.resolve('appcd-core/package.json'), 'utf8'));
	let nodeVer = corePkgJson.appcd && corePkgJson.appcd.node;
	const m = nodeVer && nodeVer.match(/(\d+\.\d+\.\d+)/);
	return m ? m[1] : null;
}

/**
 * Loads the Appc Daemon config.
 *
 * @param {Object} argv - The parsed command line arguments.
 * @returns {Config}
 */
export function loadConfig(argv) {
	const cfg = appcdLoadConfig(argv);
	log(cfg.toString());
	return cfg;
}

/**
 * Starts the Appc Daemon core.
 *
 * @param {Object} params - Various parameters.
 * @param {Config} params.cfg - The configuration object.
 * @param {Object} params.argv - The parsed arguments.
 * @param {Boolean} [params.argv.debug=false] - When `true`, spawns the core, but does not detach
 * the child process.
 * @param {Boolean} [params.argv.debugInspect=false] - When `true`, enables debug mode and listens
 * for the Node debugger.
 * @returns {Promise}
 */
export async function startServer({ cfg, argv }) {
	const { config, configFile, debug, debugInspect } = argv;
	const args = [];
	const detached = debug || debugInspect ? false : cfg.get('server.daemonize');
	const stdio = detached ? [ 'ignore', 'ignore', 'ignore', 'ipc' ] : [ 'inherit', 'inherit', 'inherit', 'ipc' ];
	const v8mem = cfg.get('core.v8.memory');
	const nodeVer = getAppcdCoreNodeVersion();

	if (debugInspect) {
		const debugPort = process.env.APPCD_INSPECT_PORT && Math.max(parseInt(process.env.APPCD_INSPECT_PORT), 1024) || 9229;
		args.push(`--inspect-brk=${debugPort}`);
	}
	args.push(require.resolve('appcd-core/dist/main'));
	if (config) {
		args.push('--config', JSON.stringify(config));
	}
	if (configFile) {
		args.push('--config-file', configFile);
	}

	process.env.APPCD = appcdVersion;
	if ((debug || debugInspect) && !argv.color) {
		process.env.APPCD_NO_COLORS = 1;
	}
	process.env.FORCE_COLOR = 1;
	process.env.PREFIX = globalPrefix;

	try {
		const { generateV8MemoryArgument, spawnNode } = await import('appcd-nodejs');
		let child;

		// check if we should use the core's required Node.js version
		if (cfg.get('core.enforceNodeVersion') !== false) {
			if (!nodeVer) {
				throw new Error(`Invalid Node.js engine version from appcd-core package.json: v${nodeVer}`);
			}

			child = await spawnNode({
				args,
				detached,
				nodeHome: expandPath(cfg.get('home'), 'node'),
				stdio,
				v8mem,
				version: `v${nodeVer}`
			});
		} else {
			// using the current Node.js version which may be incompatible with the core

			if (v8mem) {
				const arg = generateV8MemoryArgument(v8mem);
				if (arg) {
					args.unshift(arg);
				}
			}

			child = spawn(process.execPath, args, { stdio });
		}

		if (debug || debugInspect) {
			process
				.on('SIGINT', () => child.kill('SIGINT'))
				.on('SIGTERM', () => child.kill('SIGTERM'));
		}

		await new Promise((resolve, reject) => {
			child.on('message', msg => {
				if (msg === 'booted') {
					if (detached) {
						child.disconnect();
						child.unref();
					}
					resolve();
				} else if (msg === 'already running') {
					const err = new Error('Appc Daemon already started');
					err.exitCode = 4;
					reject(err);
				}
			});

			child.on('close', code => {
				if (code) {
					let err;
					if (code === 12) {
						err = new Error('Node.js inspector address already in use');
					} else if (code === 5) {
						err = new Error('Daemon cannot be run as root');
					} else {
						err = new Error('Failed to start the Appc Daemon');
					}
					err.exitCode = code;
					reject(err);
				} else {
					resolve();
				}
			});
		});
	} catch (err) {
		log(err);
		throw err;
	}
}

/**
 * Stops the Appc Daemon server, if running.
 *
 * @param {Object} params - Various parameters.
 * @param {Config} params.cfg - The configuration object.
 * @param {Boolean} [params.force=false] - When `true`, forcefully kills the server. When `false`,
 * tries to gracefully shutdown the server, but will force kill the server if it takes too long.
 * @returns {Promise} Resolves `true` if the daemon was running.
 */
export async function stopServer({ cfg, force }) {
	const pidFile = expandPath(cfg.get('server.pidFile'));

	const isAlive = () => {
		const pid = isFile(pidFile) && parseInt(fs.readFileSync(pidFile, 'utf8'));
		if (pid) {
			try {
				process.kill(pid, 0);
				log(`Server is running: ${highlight(pid)}`);
				return pid;
			} catch (e) {
				log(`pid file is stale, deleting ${highlight(pidFile)}`);
				fs.unlinkSync(pidFile);
			}
		} else {
			log('No pidfile or invalid pid');
		}
	};

	let pid = await new Promise(resolve => {
		const pid = isAlive();
		if (pid) {
			return resolve(pid);
		}

		// either we didn't have a pid file or the pid was stale

		// now we need to try to connect to the server and ask it for the
		// pid so we can kill it

		log('Attempting to connect to the daemon and get the pid');

		createRequest(cfg, '/appcd/status/pid')
			.request
			.on('response', resolve)
			.once('close', resolve)
			.once('error', err => {
				error(err.stack);
				if (err.code === 'ECONNREFUSED') {
					resolve();
				} else {
					console.error('Unable to get server pid');
					console.error(err.toString());
					process.exit(1);
				}
			});
	});

	if (!pid) {
		return false;
	}

	log('Daemon was running, attempting to stop');

	const signal = force ? 'SIGKILL' : 'SIGTERM';
	log(`Daemon is running, sending ${signal}`);
	process.kill(pid, signal);

	await sleep(500);

	// check is alive 10 times waiting 2 seconds between tries
	for (let tries = 0; tries < 30; tries++) {
		pid = isAlive();
		if (!pid) {
			log('Daemon has stopped');
			return true;
		}

		log('Daemon is still running, waiting 1 seconds');
		await sleep(1000);
	}

	log('Daemon is running, sending SIGKILL');
	process.kill(pid, 'SIGKILL');

	return true;
}
