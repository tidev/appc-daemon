import Client from 'appcd-client';
import Config from 'appcd-config';
import debug from 'debug';
import fs from 'fs';
import path from 'path';

import { assertNodeEngineVersion } from 'appcd-util';
import { connect } from 'net';
import { expandPath } from 'appcd-path';
import { isFile } from 'appcd-fs';
import { spawnNode } from 'appcd-nodejs';

const log = debug('appcd:common');

/**
 * Loads the appcd configuration.
 *
 * @param {Object} [opts] - Various options.
 * @param {Object} [opts.config] - An object with various config settings. The
 * config object will be initialized with these values, however if any user-
 * defined or environment specific config files are loaded, then this object
 * will be re-merged since it always takes precedence.
 * @param {String} [opts.configFile] - Path to a config file to load. It may be
 * a JavaScript or JSON file.
 * @returns {Config}
 */
export function loadConfig({ config, configFile } = {}) {
	const cfg = new Config({ config, configFile: path.resolve(__dirname, '../../conf/default.js') });
	let remerge = false;

	// load the user-defined config file
	if (isFile(configFile)) {
		cfg.load(configFile);
		remerge = true;
	}

	// now that the config has been loaded, we can determine the environment
	const env = cfg.get('environment') && cfg.get('environment.name') || cfg.get('environment') || 'preprod';

	// load environment specific config files
	const paths = [
		path.resolve(__dirname, `../../conf/${env}.js`),
		path.resolve(__dirname, `../../conf/${env}.json`),
		configFile && path.join(path.dirname(configFile), `${env}.js`),
		configFile && path.join(path.dirname(configFile), `${env}.json`)
	];
	for (const file of paths) {
		if (isFile(file)) {
			cfg.load(file);
			remerge = true;
		}
	}

	if (remerge && config) {
		cfg.merge(config);
	}

	log(cfg.toString());

	return cfg;
}

/**
 * Starts the Appc Daemon core.
 *
 * @param {Object} params - Various parameters.
 * @param {Config} params.cfg - The configuration object.
 * @param {Boolean} [params.debug=false] - When `true`, spawns the core, but
 * does not detach the child process.
 * @returns {Promise}
 */
export function startServer({ cfg, debug }) {
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

	return spawnNode({
		args:     [ require.resolve('appcd-core') ],
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
 * @param {Boolean} [params.force=false] - When `true`, forcefully kills the
 * server. When `false`, tries to gracefully shutdown the server, but will force
 * kill the server if it takes too long.
 * @returns {Promise}
 */
export function stopServer({ cfg, force }) {
	const pidFile = expandPath(cfg.get('server.pidFile'));
	const client = new Client({
		host: cfg.get('server.host'),
		port: cfg.get('server.port')
	});

	const isRunning = () => {
		return new Promise((resolve, reject) => {
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

			log('attempting to connect to the daemon and get the pid');

			client
				.request('/appcd/pid')
				.on('response', resolve)
				.on('close', resolve)
				.on('error', err => {
					if (err.code === 'ECONNREFUSED') {
						resolve();
					} else {
						client.disconnect();
						console.error('Couldn\'t get server pid');
						console.error(err.toString());
						process.exit(1);
					}
				});
		});
	};

	let tries = 5;

	return (function check() {
		return new Promise((resolve, reject) => {
			isRunning().then(pid => {
				if (pid) {
					if (--tries < 0) {
						return reject(new Error('Unable to stop the server'));
					}
					if (tries === 0) {
						force = true;
					}
					const signal = force ? 'SIGKILL' : 'SIGTERM';
					log(`server is running, sending ${signal}`);
					process.kill(pid, signal);
					setTimeout(() => check().then(resolve, reject), 1000);
				} else {
					console.log('Server not running');
					resolve();
				}
			});
		});
	}());
}
