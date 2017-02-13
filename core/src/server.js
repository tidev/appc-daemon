import debug from 'debug';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
import gawk from 'gawk';
import logger, { snooplogg } from './logger';
import path from 'path';
import PluginManager from 'appcd-plugin';

import { expandPath } from 'appcd-path';
import { isDir, isFile } from 'appcd-fs';
import { load as loadConfig } from 'appcd-config';

/**
 * The main server logic for the Appc Daemon. It controls all core aspects of
 * the daemon including plugins, logging, and request dispatching.
 */
export default class Server {
	/**
	 * Creates a server instance and loads the configuration.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Object} [opts.config] - A object to initialize the config with.
	 * Note that if a `configFile` is also specified, this `config` is applied
	 * AFTER the config file has been loaded.
	 * @param {String} [opts.configFile] - The path to a .js or .json config
	 * file to load.
	 * @access public
	 */
	constructor({ config, configFile } = {}) {
		/**
		 * The config object.
		 * @type {Config}
		 */
		this.config = loadConfig({
			config,
			configFile,
			defaultConfigFile: path.resolve(__dirname, '../../conf/default.js')
		});

		// gawk the internal config values so that we can watch specific props
		this.config.values = gawk(this.config.values);
		this.config.watch = listener => gawk.watch(this.config.values, listener);
		this.config.unwatch = listener => gawk.unwatch(this.config.values, listener);
	}

	/**
	 * Starts the server.
	 *
	 * @returns {Object} An object containing a public API for interacting with
	 * the server instance.
	 * @access public
	 */
	start() {
		// check if appcd is already running
		const pid = this.isRunning();
		if (pid) {
			throw new Error('Server is already running!');
		}

		process.title = 'appcd';

		// init the home directory
		const homeDir = expandPath(this.config.get('home'));
		if (!isDir(homeDir)) {
			fs.mkdirsSync(homeDir);
		}

		// init the dispatcher
		this.dispatcher = new Dispatcher();

		// init the plugin manager
		this.pluginManager = new PluginManager();

		logger.info('STARTING CORE!');

		return Promise.resolve()
			.then(() => this.pluginManager.load())
			//  - init config handler
			//  - init machine id
			//  - init analytics
			//  - load in-process and plugins
			//     - status monitor
			//     - handlers
			//     - web server
			.then(() => {
				return {
					dispatcher: this.dispatcher,
					logger
				};
			});
	}

	/**
	 * Checks if the daemon is currently running by inspecting the pid file.
	 *
	 * @returns {?Number} The running instance's pid.
	 * @access public
	 */
	isRunning() {
		const pidFile = expandPath(this.config.get('server.pidFile'));
		const pid = isFile(pidFile) && parseInt(fs.readFileSync(pidFile, 'utf8'));
		if (pid) {
			try {
				process.kill(pid, 0);
				return pid;
			} catch (e) {
				// stale pid file
				fs.unlinkSync(pidFile);
				// TODO: log('pid file was stale');
			}
		}
		return null;
	}
}
