import debug from 'debug';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
import gawk from 'gawk';
import HookEmitter from 'hook-emitter';
import path from 'path';
import PluginManager from 'appcd-plugin';
import snooplogg, { StdioStream } from './logger';
import StatusMonitor from './status-monitor';

import { expandPath } from 'appcd-path';
import { getMachineId } from 'appcd-machine-id';
import { isDir, isFile } from 'appcd-fs';
import { load as loadConfig } from 'appcd-config';

const { highlight } = snooplogg.styles;
const logger = snooplogg('appcd:server');

/**
 * The main server logic for the Appc Daemon. It controls all core aspects of
 * the daemon including plugins, logging, and request dispatching.
 */
export default class Server extends HookEmitter {
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
		super();

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

		/**
		 * The appcd version.
		 * @type {String}
		 */
		this.version = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')).version;
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
			throw new Error(`Server is already running! (pid: ${pid})`);
		}

		process.title = 'appcd';

		snooplogg.enable('*').pipe(new StdioStream, { flush: true });

		logger.log(`Appcelerator Daemon v${this.version}`);
		logger.log('Environment: %s', highlight(this.config.get('environment.title')));
		logger.log(`PID: ${highlight(process.pid)}`);
		logger.log(`Node.js ${process.version} (module v${process.versions.modules})`);

		process.on('SIGINT',  () => this.shutdown().then(() => process.exit(0)));
		process.on('SIGTERM', () => this.shutdown().then(() => process.exit(0)));

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
				const filter = ctx.params.key && ctx.params.key.replace(/^\//, '').split('/').join('.') || undefined;
				const node = this.config.get(filter);
				if (!node) {
					throw new Error(`Invalid request: ${ctx.path}`);
				}
				ctx.response.write(JSON.stringify(node, null, '  '));
			})
			.register('/appcd/logcat', ctx => {
				snooplogg.pipe(ctx.response, { flush: true });
			})
			.register('/appcd/plugins', ctx => {
				//
			})
			.register('/appcd/status/:filter*', ctx => {
				const filter = ctx.params.filter && ctx.params.filter.replace(/^\//, '').split(/\.|\//) || undefined;
				const node = this.statusMonitor.get(filter);
				if (!node) {
					throw new Error(`Invalid request: ${ctx.path}`);
				}

				ctx.response.write(node.toJSON(true));

				if (ctx.data.continuous) {
					const off = node.watch(evt => ctx.response.write(evt.source.toJSON(true)));
					ctx.response.on('close', off);
					ctx.response.on('error', off);
				} else {
					ctx.response.close();
				}
			});

		return Promise.resolve()
			.then(() => {
				return getMachineId(path.join(homeDir, '.mid'))
					.then(mid => this.mid = mid);
			})
			// init analytics
			// enable plugins
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
			//     - status monitor
			//     - handlers
			//     - web server
			.then(() => this.emit('appcd.start'))
			.then(() => ({
				dispatcher: this.dispatcher,
				logger
			}));
	}

	/**
	 * Shutsdown the server. All connections will be terminated after 30
	 * seconds.
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
				const pidFile = expandPath(this.config('appcd.pidFile'));
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
				appcd.logger.info('appcd shutdown successfully');
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
				fs.unlinkSync(pidFile);
				// TODO: log('pid file was stale');
			}
		}
		return null;
	}
}
