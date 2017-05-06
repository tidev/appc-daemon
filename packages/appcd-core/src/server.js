import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
import FSWatchManager from 'appcd-fswatcher';
import gawk from 'gawk';
import HookEmitter from 'hook-emitter';
import path from 'path';
import PluginManager, { Plugin } from 'appcd-plugin';
import snooplogg, { logcat, StdioStream } from './logger';
import StatusMonitor from './status-monitor';
import SubprocessManager from 'appcd-subprocess';
import WebServer from 'appcd-http';
import WebSocketSession from './websocket-session';

import { expandPath } from 'appcd-path';
import { getActiveHandles } from 'double-stack';
import { getMachineId } from 'appcd-machine-id';
import { i18n } from 'appcd-response';
import { isDir, isFile } from 'appcd-fs';
import { load as loadConfig } from 'appcd-config';

const { __, __n } = i18n();

const { highlight, notice } = snooplogg.styles;
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

		// check if the current user is root
		let uid, gid;
		if (process.getuid && process.getuid() === 0) {
			// we are on a posix system and we're root, so we need to switch to a non-root user
			uid = this.config.get('server.user');
 			gid = this.config.get('server.group');
			if (!uid) {
				throw new Error('The daemon cannot be run as root. You must run as a non-root user or set a user in the config.');
			}
			process.setuid(uid);
			if (gid) {
				process.setgid(gid);
			}
		}

		// check if appcd is already running
		const pid = this.isRunning();
		if (pid) {
			throw new Error(`Server is already running! (pid: ${pid})`);
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

		// init the status monitor
		this.statusMonitor = new StatusMonitor();
		const { status } = this.statusMonitor;
		status.version = this.version;

		// init the fs watch manager
		const fm = this.fswatchManager = new FSWatchManager();
		fm.on('stats', stats => status.fswatch = stats);
		status.fswatch = fm.status();

		// init the subprocess manager
		const sm = this.subprocessManager = new SubprocessManager();
		sm.on('change', subprocesses => status.subprocesses = subprocesses);
		status.subprocesses = sm.subprocesses;

		// init the plugin manager
		const pm = this.pluginManager = new PluginManager({
			paths: [
				path.resolve(__dirname, '..', '..', '..', 'plugins'),
				path.join(homeDir, 'plugins')
			]
		});
		pm.on('change', plugins => status.plugins = plugins);
		status.plugins = pm.plugins;

		// start the status monitor
		this.statusMonitor.start();

		// init the dispatcher
		const appcdDispatcher = new Dispatcher()
			.register('/config/:key*', ctx => {
				const filter = ctx.params.key && ctx.params.key.replace(/^\//, '').split(/\.|\//).join('.') || undefined;
				const node = this.config.get(filter);
				if (!node) {
					throw new Error(`Invalid request: ${ctx.path}`);
				}
				ctx.response = node;
			})

			.register('/fswatch', this.fswatchManager.dispatcher)

			.register('/logcat', ctx => logcat(ctx.response))

			.register('/plugin', this.pluginManager.dispatcher)

			.register('/status', this.statusMonitor.dispatcher)

			.register('/subprocess', this.subprocessManager.dispatcher);

		Dispatcher.register('/appcd', appcdDispatcher);

		// init the web server
		this.webserver = new WebServer({
			hostname: this.config.get('server.host', '127.0.0.1'),
			port:     this.config.get('server.port'),
			webroot:  path.resolve(__dirname, '..', 'public')
		});

		this.webserver.use(Dispatcher.callback());
		this.webserver.on('websocket', ws => new WebSocketSession(ws));

		return Promise.resolve()
			.then(() => {
				return getMachineId(path.join(homeDir, '.mid'))
					.then(mid => this.mid = mid);
			})
			// TODO: init telemetry
			.then(() => this.webserver.listen())
			.then(() => this.emit('appcd.start'));
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
			.then(() => this.webserver.close())
			.then(() => this.pluginManager.shutdown())
			.then(() => this.subprocessManager.shutdown())
			.then(() => this.fswatchManager.shutdown())
			.then(() => this.statusMonitor.shutdown())
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

					let i = 1;
					for (const timer of timers) {
						logger.warn(`${i++}) ${highlight(timer.__stack__[0] || 'unknown origin')}`);
					}

					logger.warn('Did you forget to clear these timeouts during the %s event?', highlight('"appcd.shutdown"'));
					handles.timers.forEach(t => clearTimeout(t));
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
