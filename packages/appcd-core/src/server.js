import debug from 'debug';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
import gawk from 'gawk';
import HookEmitter from 'hook-emitter';
import path from 'path';
import PluginManager from 'appcd-plugin';
import snooplogg, { StdioStream } from './logger';
import StatusMonitor from './status-monitor';
import WebServer from 'appcd-http';
import WebSocketSession from './websocket-session';

import { expandPath } from 'appcd-path';
import { getMachineId } from 'appcd-machine-id';
import { isDir, isFile } from 'appcd-fs';
import { load as loadConfig } from 'appcd-config';

const { highlight } = snooplogg.styles;
const logger = snooplogg('appcd:server');

/**
 * The main server logic for the Appc Daemon. It controls all core aspects of the daemon including
 * plugins, logging, and request dispatching.
 */
export default class Server extends HookEmitter {
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
		super();

		/**
		 * The config object.
		 * @type {Config}
		 */
		this.config = loadConfig({
			config,
			configFile,
			defaultConfigFile: path.resolve(__dirname, '../../../conf/default.js')
		});

		// gawk the internal config values so that we can watch specific props
		this.config.values = gawk(this.config.values);
		this.config.watch = listener => gawk.watch(this.config.values, listener);
		this.config.unwatch = listener => gawk.unwatch(this.config.values, listener);

		/**
		 * The appcd version.
		 * @type {String}
		 */
		this.version = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')).version;
	}

	/**
	 * Starts the server.
	 *
	 * @returns {Object} An object containing a public API for interacting with the server instance.
	 * @access public
	 */
	start() {
		// enable logging
		snooplogg
			.enable('*')
			.pipe(new StdioStream, { flush: true });

		// check if appcd is already running
		const pid = this.isRunning();
		if (pid) {
			throw new Error(`Server is already running! (pid: ${pid})`);
		}

		process.title = 'appcd';

		logger.log(`Appcelerator Daemon v${this.version}`);
		logger.log('Environment: %s', highlight(this.config.get('environment.title')));
		logger.log(`PID: ${highlight(process.pid)}`);
		logger.log(`Node.js ${process.version} (${process.platform}, module v${process.versions.modules})`);

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

		this.statusMonitor = new StatusMonitor();
		this.statusMonitor.status.appcd.version = this.version;
		this.statusMonitor.start();
		this.on('appcd:shutdown', () => this.statusMonitor.stop());

		// init the plugin manager
		this.pluginManager = new PluginManager({
			paths: [
				path.resolve(__dirname, '..', 'plugins'),
				path.join(homeDir, 'plugins')
			]
		});

		// init the dispatcher
		this.dispatcher = new Dispatcher()
			.register('/appcd/config/:key*', ctx => {
				const filter = ctx.params.key && ctx.params.key.replace(/^\//, '').split(/\.|\//).join('.') || undefined;
				const node = this.config.get(filter);
				if (!node) {
					throw new Error(`Invalid request: ${ctx.path}`);
				}
				ctx.response = node;
			})

			.register('/appcd/logcat', ctx => {
				snooplogg.pipe(ctx.response, { flush: true });
			})

			.register('/appcd/plugins', ctx => {
				ctx.response.end('foo');
			})

			.register(this.statusMonitor.service);

		// init the web server
		this.webserver = new WebServer({
			hostname: this.config.get('server.host', '127.0.0.1'),
			port:     this.config.get('server.port'),
			webroot:  path.resolve(__dirname, '..', 'public')
		});

		this.webserver.use(this.dispatcher.callback());
		this.webserver.on('websocket', ws => new WebSocketSession(ws, this.dispatcher));

		return Promise.resolve()
			.then(() => {
				return getMachineId(path.join(homeDir, '.mid'))
					.then(mid => this.mid = mid);
			})
			// init analytics
			// load plugins
			.then(() => {
				const pidFile = expandPath(this.config.get('server.pidFile'));
				const dir = path.dirname(pidFile);
				if (!isDir(dir)) {
					fs.mkdirsSync(dir);
				}

				// since we are not running as a daemon, we have to write the pid file ourselves
				fs.writeFileSync(pidFile, process.pid);
			})
			//  - load in-process and plugins
			//     - handlers
			.then(() => this.webserver.listen())
			.then(() => this.emit('appcd.start'))
			.then(() => ({
				dispatcher: this.dispatcher,
				logger
			}));
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
			// .then(() => this.emit('analytics:event', {
			// 	type: 'appcd.server.shutdown',
			// 	uptime: this.status.get(['appcd', 'uptime']).toJS()
			// }))
			.then(() => this.emit('appcd:shutdown'))
			// TODO: shutdown web server
			// TODO: shutdown plugin manager
			.then(() => {
				const pidFile = expandPath(this.config.get('server.pidFile'));
				logger.log('Removing %s', highlight(pidFile));
				fs.unlinkSync(pidFile);
			})
			// .then(() => {
			// 	const handles = getActiveHandles();
			//
			// 	if (handles.timers.length) {
			// 		const timers = handles.timers.filter(timer => timer.__stack__);
			// 		appcd.logger.warn(`Stopping ${appcd.logger.notice(timers.length)} active ${pluralize('timers', timers.length)}:`);
			// 		let i = 1;
			// 		for (const timer of timers) {
			// 			appcd.logger.warn(`${i++}) ${appcd.logger.highlight(timer.__stack__[0] || 'unknown origin')}`);
			// 		}
			// 		appcd.logger.warn(`Did you forget to clear these timeouts during the ${appcd.logger.highlight('"appcd.shutdown"')} event?`);
			// 		handles.timers.forEach(t => clearTimeout(t));
			// 	}
			// })
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
