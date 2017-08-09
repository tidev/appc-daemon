import ConfigService from 'appcd-config-service';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
import FSWatchManager from 'appcd-fswatcher';
import gawk from 'gawk';
import path from 'path';
import PluginManager from 'appcd-plugin';
import appcdLogger, { logcat, StdioStream } from './logger';
import StatusMonitor from './status-monitor';
import SubprocessManager from 'appcd-subprocess';
import Telemetry from 'appcd-telemetry';
import WebServer from 'appcd-http';
import WebSocketSession from './websocket-session';

import { expandPath } from 'appcd-path';
import { getActiveHandles } from 'appcd-util';
import { i18n } from 'appcd-response';
import { isDir, isFile } from 'appcd-fs';
import { load as loadConfig } from 'appcd-config';

const { __n } = i18n();

const logger = appcdLogger('appcd:server');
const { highlight, notice } = appcdLogger.styles;

/**
 * The main server logic for the Appc Daemon. It controls all core aspects of the daemon including
 * plugins, logging, and request dispatching.
 */
export default class Server {
	/**
	 * Creates a server instance and loads the configuration.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Object} [opts.config] - A object to initialize the config with. Note that if a
	 * `configFile` is also specified, this `config` is applied AFTER the config file has been
	 * loaded.
	 * @param {String} [opts.configFile] - The path to a .js or .json config file to load.
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
			defaultConfigFile: path.resolve(__dirname, '../../../conf/default.js')
		});

		// if we didn't have a `configFile`, then load the user config file
		if (!configFile && isFile(configFile = expandPath(this.config.get('home'), 'config.json'))) {
			this.config.load(configFile);

			// if we had a `config` object, then we need to re-merge it on top of the user config
			if (config) {
				this.config.merge(config);
			}
		}

		// gawk the internal config values so that we can watch specific props
		this.config.values = gawk(this.config.values);
		this.config.watch = (filter, listener) => gawk.watch(this.config.values, filter, listener);
		this.config.unwatch = listener => gawk.unwatch(this.config.values, listener);

		/**
		 * The appcd version.
		 * @type {String}
		 * @access private
		 */
		this.version = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')).version;

		/**
		 * A list of systems.
		 */
		this.systems = {};
	}

	/**
	 * Starts the server.
	 *
	 * @returns {Promise} An object containing a public API for interacting with the server instance.
	 * @access public
	 */
	async start() {
		// enable logging
		appcdLogger
			.enable('*')
			.pipe(new StdioStream(), { flush: true });

		// check if the current user is root
		let uid, gid;
		if (process.getuid && process.getuid() === 0) {
			// we are on a posix system and we're root, so we need to switch to a non-root user
			uid = this.config.get('server.user');
			gid = this.config.get('server.group');
			if (!uid) {
				const err = new Error('The daemon cannot be run as root. You must run as a non-root user or set a user in the config.');
				err.code = 5;
				throw err;
			}
			process.setuid(uid);
			if (gid) {
				process.setgid(gid);
			}
		}

		// check if appcd is already running
		const pid = this.isRunning();
		if (pid) {
			const err = new Error(`Server is already running! (pid: ${pid})`);
			err.code = 4;
			throw err;
		}

		// write the pid file
		const pidFile = expandPath(this.config.get('server.pidFile'));
		const pidDir = path.dirname(pidFile);
		if (!isDir(pidDir)) {
			fs.mkdirsSync(pidDir);
		}
		fs.writeFileSync(pidFile, process.pid);

		// rename the process
		process.title = 'appcd';

		logger.log(`Appcelerator Daemon v${this.version}`);
		logger.log('Environment: %s', highlight(this.config.get('environment.title')));
		logger.log(`Node.js ${process.version} (${process.platform}, module v${process.versions.modules})`);
		logger.log(`PID: ${highlight(process.pid)}`);

		// listen for CTRL-C and SIGTERM
		const shutdown = () => this.shutdown()
			.then(() => process.exit(0))
			.catch(logger.error);
		process.once('SIGINT',  shutdown);
		process.once('SIGTERM', shutdown);

		// init the home directory
		const homeDir = expandPath(this.config.get('home'));
		if (!isDir(homeDir)) {
			logger.debug('Creating home directory %s', homeDir);
			fs.mkdirsSync(homeDir);
		}

		// init the telemetry system
		this.systems.telemetry = new Telemetry(this.config);
		await this.systems.telemetry.init(homeDir);
		Dispatcher.register('/appcd/telemetry', this.systems.telemetry);

		// init the config service
		Dispatcher.register('/appcd/config', new ConfigService(this.config));

		// init logcat
		Dispatcher.register('/appcd/logcat', ctx => logcat(ctx.response));

		// init the status monitor
		this.systems.statusMonitor = new StatusMonitor();
		Dispatcher.register('/appcd/status', this.systems.statusMonitor.dispatcher);

		// init the fs watch manager
		this.systems.fswatchManager = new FSWatchManager();
		Dispatcher.register('/appcd/fs/watch', this.systems.fswatchManager.dispatcher);

		// init the subprocess manager
		this.systems.subprocessManager = new SubprocessManager();
		Dispatcher.register('/appcd/subprocess', this.systems.subprocessManager.dispatcher);

		// init the plugin manager
		this.systems.pluginManager = new PluginManager({
			paths: [
				// built-in plugins
				path.resolve(__dirname, '..', '..', '..', 'plugins'),

				// globally installed plugins
				path.join(homeDir, 'plugins')
			]
		});
		Dispatcher.register('/appcd/plugin', this.systems.pluginManager.dispatcher);

		// start the status monitor
		this.systems.statusMonitor
			.merge({
				version:      this.version,
				fs:           this.systems.fswatchManager.status(),
				subprocesses: this.systems.subprocessManager.subprocesses,
				plugins:      this.systems.pluginManager.plugins
			})
			.start();

		// listen for fswatcher stats and update the status
		this.systems.fswatchManager.on('stats', stats => {
			this.systems.statusMonitor.merge({ fs: stats });
		});

		// init the web server
		this.systems.webserver = new WebServer({
			hostname: this.config.get('server.host', '127.0.0.1'),
			port:     this.config.get('server.port'),
			webroot:  path.resolve(__dirname, '..', 'public')
		});

		this.systems.webserver
			.use(Dispatcher.callback())
			.on('websocket', (ws, req) => new WebSocketSession(ws, req));

		// start the web server
		await this.systems.webserver.listen();

		// send the server start event
		await Dispatcher.call('/appcd/telemetry', {
			event: 'appcd.server.start'
		});
	}

	/**
	 * Shutsdown the server.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	shutdown() {
		logger.log('Shutting down server gracefully');

		return Promise.resolve()
			.then(() => Dispatcher.call('/appcd/telemetry', {
				event:  'appcd.server.shutdown',
				uptime: process.uptime()
			}))
			.then(async () => {
				for (const system of Object.values(this.systems)) {
					if (typeof system.shutdown === 'function') {
						await system.shutdown();
					}
				}
			})
			.then(() => {
				const pidFile = expandPath(this.config.get('server.pidFile'));
				logger.log('Removing %s', highlight(pidFile));
				fs.unlinkSync(pidFile);
			})
			.then(() => {
				const handles = getActiveHandles();
				const timers = handles.timers.filter(timer => timer.__stack__);
				if (timers.length) {
					logger.warn(__n(timers.length, 'Stopping %%s active timer', 'Stopping %%s active timers', notice(timers.length)));
					for (const timer of handles.timers) {
						clearTimeout(timer);
					}
				}
			})
			.then(() => {
				logger.log('appcd shutdown successfully');
				return this;
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
				logger.info('%s was stale', highlight(pidFile));
				fs.unlinkSync(pidFile);
			}
		}
		return null;
	}
}
