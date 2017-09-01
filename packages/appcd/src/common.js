import Client from 'appcd-client';
import fs from 'fs';
import path from 'path';
import appcdLogger from 'appcd-logger';

import { expandPath } from 'appcd-path';
import { isFile } from 'appcd-fs';
import { spawnNode } from 'appcd-nodejs';

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
		+ 'Copyright (c) 2016-2017, Appcelerator, Inc. All Rights Reserved.\n';
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
		configFile:        argv.configFile,
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
	const corePkgJson = JSON.parse(fs.readFileSync(require.resolve('appcd-core/package.json'), 'utf8'));
	let nodeVer = corePkgJson.engines.node;
	const m = nodeVer.match(/(\d+\.\d+\.\d+)/);

	if (m) {
		nodeVer = `v${m[1]}`;
	} else if (nodeVer) {
		throw new Error(`Invalid Node.js engine version from appcd-core package.json: ${nodeVer}`);
	} else {
		throw new Error('Unable to determine Node.js engine version from appcd-core package.json');
	}

	const { config, configFile, debug } = argv;
	const args = [];
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

	return spawnNode({
		args,
		detached: debug ? false : cfg.get('server.daemonize'),
		nodeHome: expandPath(cfg.get('home'), 'node'),
		version:  nodeVer,
		v8mem:    cfg.get('core.v8.memory')
	});
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
	const client = new Client({
		host: cfg.get('server.host'),
		port: cfg.get('server.port')
	});

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

				resolve();
			}, 1000);
		});
	}

	return isRunning().then(pid => sendKill(pid));
}
