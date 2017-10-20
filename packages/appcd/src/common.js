import Client from 'appcd-client';
import fs from 'fs';
import path from 'path';
import appcdLogger from 'appcd-logger';

import { expandPath } from 'appcd-path';
import { generateV8MemoryArgument, spawnNode } from 'appcd-nodejs';
import { isFile } from 'appcd-fs';
import { spawn } from 'child_process';

import * as config from 'appcd-config';

const { log } = appcdLogger('appcd:common');
const { highlight } = appcdLogger.styles;

let appcdVersion = null;

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
 * Creates the banner that is displayed at the beginning of the command.
 *
 * @returns {String}
 */
export function banner() {
	return `${highlight('Appcelerator Daemon')}, version ${getAppcdVersion()}\n`
		+ 'Copyright (c) 2016-2017, Axway, Inc. All Rights Reserved.\n';
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
		userAgent: `appcd/${appcdVersion}}`
	});

	log('Creating request: %s', highlight(`${type || 'call'}://${client.host}:${client.port}${path}`));
	const request = client
		.request({ path, data, type })
		.once('close', () => process.exit(0))
		.once('error', err => {
			if (err.code !== 'ECONNREFUSED') {
				process
					.removeListener('SIGINT', disconnect)
					.removeListener('SIGTERM', disconnect);
			}
		});

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
 * Loads the Appc Daemon config.
 *
 * @param {Object} argv - The parsed command line arguments.
 * @returns {Config}
 */
export function loadConfig(argv) {
	const cfg = config.load({
		config:            argv.config,
		configFile:        argv.configFile || expandPath('~/.appcelerator/appcd/config.json'),
		defaultConfigFile: require.resolve('appcd-core/conf/default.js')
	});
	log(cfg.toString());
	return cfg;
}

/**
 * Starts the Appc Daemon core.
 *
 * @param {Object} params - Various parameters.
 * @param {Config} params.cfg - The configuration object.
 * @param {Boolean} [params.debug=false] - When `true`, spawns the core, but does not detach the
 * child process.
 * @returns {Promise}
 */
export function startServer({ cfg, argv }) {
	const { config, configFile, debug } = argv;
	const args = [];
	const detached = debug ? false : cfg.get('server.daemonize');
	const v8mem = cfg.get('core.v8.memory');
	const corePkgJson = JSON.parse(fs.readFileSync(require.resolve('appcd-core/package.json'), 'utf8'));

	let nodeVer = corePkgJson.engines && corePkgJson.engines.node;
	const m = nodeVer && nodeVer.match(/(\d+\.\d+\.\d+)/);
	nodeVer = m ? `v${m[1]}` : null;

	if (debug) {
		args.push('--inspect');
	}
	args.push(require.resolve('appcd-core'));
	if (config) {
		args.push('--config', JSON.stringify(config));
	}
	if (configFile) {
		args.push('--config-file', configFile);
	}

	process.env.APPCD_BOOTSTRAP = appcdVersion;

	// check if we should use the core's required Node.js version
	if (cfg.get('core.enforceNodeVersion') !== false) {
		if (!nodeVer) {
			throw new Error(`Invalid Node.js engine version from appcd-core package.json: ${nodeVer}`);
		}

		return spawnNode({
			args,
			detached,
			nodeHome: expandPath(cfg.get('home'), 'node'),
			version:  nodeVer,
			v8mem
		});
	}

	// using the current Node.js version which may be incompatible with the core

	if (v8mem) {
		const arg = generateV8MemoryArgument(v8mem);
		if (arg) {
			args.unshift(arg);
		}
	}

	const opts = {};
	if (detached) {
		opts.detached = true;
		opts.stdio = 'ignore';
	}

	return spawn(process.execPath, args, opts);
}

/**
 * Stops the Appc Daemon server, if running.
 *
 * @param {Object} params - Various parameters.
 * @param {Config} params.cfg - The configuration object.
 * @param {Boolean} [params.force=false] - When `true`, forcefully kills the server. When `false`,
 * tries to gracefully shutdown the server, but will force kill the server if it takes too long.
 * @returns {Promise}
 */
export function stopServer({ cfg, force }) {
	const pidFile = expandPath(cfg.get('server.pidFile'));

	const isRunning = () => {
		return new Promise(resolve => {
			const pid = isFile(pidFile) && parseInt(fs.readFileSync(pidFile, 'utf8'));
			if (pid) {
				try {
					process.kill(pid, 0);
					// server is running
					return resolve(pid);
				} catch (e) {
					// stale pid file
					fs.unlinkSync(pidFile);
					log('pid file was stale');
				}
			}

			// either we didn't have a pid file or the pid was stale

			// now we need to try to connect to the server and ask it for the
			// pid so we can kill it

			log('Attempting to connect to the daemon and get the pid');

			createRequest(cfg, '/appcd/pid')
				.request
				.on('response', resolve)
				.once('close', resolve)
				.once('error', err => {
					if (err.code === 'ECONNREFUSED') {
						resolve();
					} else {
						console.error('Unable to get server pid');
						console.error(err.toString());
						process.exit(1);
					}
				});
		});
	};

	let tries = 5;
	let wasRunning = false;

	function sendKill(pid) {
		return new Promise((resolve, reject) => {
			if (!pid) {
				return resolve(wasRunning);
			}
			if (!wasRunning) {
				log('Daemon was running, attempting to stop');
			}
			wasRunning = true;
			if (--tries < 0) {
				return reject(new Error('Unable to stop the server'));
			}
			if (tries === 0) {
				force = true;
			}

			const signal = force ? 'SIGKILL' : 'SIGTERM';
			log(`Server is running, sending ${signal}`);
			process.kill(pid, signal);

			setTimeout(() => {
				try {
					process.kill(pid, 0);
					// daemon didn't die, force!
					force = true;
					sendKill(pid).then(resolve, reject);
					return;
				} catch (e) {
					// squeltch
				}

				resolve(wasRunning);
			}, 1000);
		});
	}

	return isRunning().then(pid => sendKill(pid));
}
