import appcdCoreLogger, { LogcatFormatter } from './logger';
import ConfigService from 'appcd-config-service';
import Dispatcher from 'appcd-dispatcher';
import fs from 'fs-extra';
import FSWatcher from 'appcd-fswatcher';
import FSWatchManager from 'appcd-fswatch-manager';
import globalModules from 'global-modules';
import os from 'os';
import path from 'path';
import PluginManager from 'appcd-plugin';
import StatusMonitor from './status-monitor';
import SubprocessManager from 'appcd-subprocess';
import Telemetry from 'appcd-telemetry';
import WebServer from 'appcd-http';
import WebSocketSession from './websocket-session';

import { arch as getArch, arrayify, get, trackTimers } from 'appcd-util';
import { expandPath } from 'appcd-path';
import { i18n } from 'appcd-response';
import { installDefaultPlugins } from 'appcd-default-plugins';
import { isDir, isFile } from 'appcd-fs';
import { load as loadConfig } from 'appcd-config';
import { purgeUnusedNodejsExecutables } from 'appcd-nodejs';

const { __n } = i18n();

const logger = appcdCoreLogger('appcd:server');
const { highlight, notice } = appcdCoreLogger.styles;

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
			defaultConfigFile: path.resolve(__dirname, '..', 'conf', 'default.js')
		});

		// if we didn't have a `configFile`, then load the user config file
		if (!configFile && isFile(configFile = expandPath(this.config.get('home'), 'config.json'))) {
			this.config.loadUserConfig(configFile);

			// if we had a `config` object, then we need to re-merge it on top of the user config
			if (config) {
				this.config.merge(config);
			}
		}

		/**
		 * The appcd version.
		 * @type {String}
		 */
		this.version = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')).version;

		/**
		 * A function to call that stops tracking timers and returns an array of active timers.
		 * @type {Function}
		 */
		this.stopTrackingTimers = trackTimers();

		/**
		 * A list of systems.
		 * @type {Object}
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
		const uid = this.config.get('server.user');
		const gid = this.config.get('server.group');

		if (process.getuid && process.getuid() === 0) {
			// we are on a posix system and we're root, so we need to switch to a non-root user
			if (!uid) {
				const err = new Error('The daemon cannot be run as root. You must run as a non-root user or set a user in the config.');
				err.code = 5;
				throw err;
			}
		}

		// check if appcd is already running
		const pid = this.isRunning();
		if (pid) {
			const err = new Error(`Server is already running! (pid: ${pid})`);
			process.send('already running');
			err.code = 4;
			throw err;
		}

		// write the pid file
		this.pidFile = expandPath(this.config.get('server.pidFile'));
		const pidDir = path.dirname(this.pidFile);
		if (!isDir(pidDir)) {
			fs.mkdirsSync(pidDir);
		}
		fs.writeFileSync(this.pidFile, process.pid);

		// rename the process
		process.title = 'appcd';

		logger.log(`Appcelerator Daemon v${this.version}`);
		logger.log('Environment: %s', highlight(this.config.get('environment.title')));
		logger.log(`Node.js ${process.version} (${process.platform}, module v${process.versions.modules})`);
		logger.log(`PID: ${highlight(process.pid)}`);

		// init the home directory
		const homeDir = expandPath(this.config.get('home'));
		if (!isDir(homeDir)) {
			logger.debug('Creating home directory %s', homeDir);
			fs.mkdirsSync(homeDir);
		}

		// install default plugins before we drop permissions
		try {
			await installDefaultPlugins(path.join(homeDir, 'plugins'));
		} catch (err) {
			if (err.code === 'EACCES') {
				logger.warn(err);
			} else {
				logger.error(err);
			}
		}

		// check if the current user is root
		if (process.getuid && process.getuid() === 0) {
			process.setuid(uid);
			if (gid) {
				process.setgid(gid);
			}
		}

		// watch the pid to make sure it always exists
		this.pidWatcher = new FSWatcher(this.pidFile)
			.on('change', ({ action }) => {
				if (action === 'delete') {
					logger.log('pid file deleted, recreating');
					fs.writeFileSync(this.pidFile, process.pid);
				}
			});

		// listen for CTRL-C and SIGTERM
		const shutdown = async () => {
			try {
				await this.shutdown();
				process.exit(0);
			} catch (err) {
				logger.error(err);
			}
		};
		process.on('SIGINT',  shutdown);
		process.on('SIGTERM', shutdown);

		// import any Titanium CLI configuration settings
		await this.importTiConfig();

		// init the telemetry system
		this.systems.telemetry = new Telemetry(this.config, this.version);
		await this.systems.telemetry.init(homeDir);
		Dispatcher.register('/appcd/telemetry', this.systems.telemetry);

		// init the config service
		Dispatcher.register('/appcd/config', new ConfigService(this.config));

		// init logcat
		Dispatcher.register('/appcd/logcat', ({ response }) => {
			const formatter = new LogcatFormatter();
			formatter.pipe(response);
			appcdCoreLogger.pipe(formatter, { flush: true });
		});

		// init the status monitor
		this.systems.statusMonitor = new StatusMonitor(this.config);
		Dispatcher.register('/appcd/status', this.systems.statusMonitor);

		// init the fs watch manager
		this.systems.fswatchManager = new FSWatchManager();
		Dispatcher.register('/appcd/fswatch', this.systems.fswatchManager);

		// init the subprocess manager
		this.systems.subprocessManager = new SubprocessManager();
		Dispatcher.register('/appcd/subprocess', this.systems.subprocessManager);

		// init the plugin manager
		this.systems.pluginManager = new PluginManager({
			paths: [
				// globally installed plugins
				path.join(homeDir, 'plugins', 'packages'),

				// global npm directory
				globalModules
			]
		});

		Dispatcher.register('/appcd/plugin', this.systems.pluginManager);

		// start the status monitor
		this.systems.statusMonitor
			.merge({
				version:      this.version,
				fs:           this.systems.fswatchManager.status(),
				subprocesses: this.systems.subprocessManager.subprocesses,
				plugins:      this.systems.pluginManager.status()
			})
			.start();

		Dispatcher.register('/appcd/health', async (ctx) => {
			ctx.response = [
				{
					pid:   process.pid,
					title: process.title,
					desc:  'appcd-core',
					...this.systems.statusMonitor.agent.health()
				}
			].concat(await this.systems.pluginManager.health());
		});

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

		const telemetryRequest = req => {
			Dispatcher.call('/appcd/telemetry', {
				event: 'dispatch',
				...req
			}).catch(err => {
				logger.warn(`Failed to log HTTP dispatcher request: ${err.message}`);
			});
		};

		this.systems.webserver
			.use(Dispatcher.callback(telemetryRequest))
			.on('websocket', (ws, req) => new WebSocketSession(ws, req).on('request', telemetryRequest));

		// start the web server
		await this.systems.webserver.listen();

		const startupTime = process.uptime();
		this.systems.statusMonitor.data.startupTime = startupTime;

		// send the server start event
		await Dispatcher.call('/appcd/telemetry', {
			amplifyCLI:  process.env.AMPLIFY_CLI || null,
			arch:        getArch(),
			cpus:        os.cpus().length,
			event:       'ti.start',
			env:         this.config.get('environment.name'),
			memory:      os.totalmem(),
			nodeVersion: process.version,
			platform:    process.platform,
			plugins:     this.systems.pluginManager.registered.map(p => ({
				name:        p.name,
				packageName: p.packageName,
				nodeVersion: p.nodeVersion,
				version:     p.version,
				type:        p.type
			})),
			startupTime
		});

		// cleanup unused Node.js executables every hour
		this.unsuedNodeCleanupTimer = setInterval(() => this.purgeUnusedNodejs(), 60 * 60 * 1000);
		this.purgeUnusedNodejs();
	}

	/**
	 * Checks if there are any unused Node.js executables that should be purged.
	 *
	 * @access private
	 */
	purgeUnusedNodejs() {
		const purged = purgeUnusedNodejsExecutables({
			maxAge: this.config.get('server.nodejsMaxUnusedAge', 90 * 24 * 60 * 60 * 1000),
			nodeHome: expandPath(this.config.get('home'), 'node')
		});

		if (purged.length) {
			Dispatcher.call('/appcd/telemetry', {
				event: 'server.node_purge',
				purged
			});
		}
	}

	/**
	 * Shutsdown the server.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async shutdown() {
		logger.log('Shutting down server gracefully');

		if (this.unsuedNodeCleanupTimer) {
			clearInterval(this.unsuedNodeCleanupTimer);
			this.unsuedNodeCleanupTimer = null;
		}

		await Dispatcher.call('/appcd/telemetry', {
			event:  'ti.end',
			uptime: process.uptime()
		});

		for (const [ name, system ] of Object.entries(this.systems)) {
			if (typeof system.shutdown === 'function') {
				logger.log(`Shutting down ${name}...`);
				await system.shutdown();
			}
		}

		if (this.pidWatcher) {
			logger.log('Stopping pid watcher');
			this.pidWatcher.close();
		}

		if (isFile(this.pidFile)) {
			logger.log('Removing %s', highlight(this.pidFile));
			fs.unlinkSync(this.pidFile);
		}

		const timers = this.stopTrackingTimers();
		if (timers.length) {
			logger.warn(__n(timers.length, 'Stopping %%s active timer', 'Stopping %%s active timers', notice(timers.length)));
			for (const timer of timers) {
				clearTimeout(timer);
			}
		}

		logger.log('appcd shutdown successfully');
		return this;
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
				logger.log('%s was stale', highlight(pidFile));
				fs.unlinkSync(pidFile);
			}
		}
		return null;
	}

	/**
	 * Performs a one-time import of the Titanium CLI config file.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async importTiConfig() {
		if (this.config.get('titanium.configImported')) {
			logger.log('Titanium CLI config already imported');
			return;
		}

		const tiConf = expandPath('~', '.titanium', 'config.json');
		if (!isFile(tiConf)) {
			logger.log('Titanium CLI config not found, skipping import');
			return;
		}

		const json = fs.readJsonSync(tiConf, { throws: false });
		if (!json || typeof json !== 'object') {
			logger.log('Titanium CLI config is invalid, skipping import');
			return;
		}

		// start importing settings
		this.config.set('titanium.configImported', true);

		const copySetting = (src, dest, type) => {
			if (this.config.get(dest)) {
				return;
			}

			let value = get(json, src);
			if (!value) {
				return;
			}

			switch (type) {
				case 'number':
					value = parseInt(value, 10);
					if (isNaN(value)) {
						return;
					}
					break;

				case 'array':
					value = arrayify(value, true);
					if (!value.length) {
						return;
					}
					break;
			}

			logger.log('Importing %s => %s: %s', highlight(src), highlight(dest), highlight(value));
			this.config.set(dest, value);
		};

		copySetting('android.adb.port',                  'android.adb.port',                'number');
		copySetting('android.appInstallTimeout',         'android.adb.install.timeout',     'number');
		copySetting('android.appStartTimeout',           'android.adb.start.timeout',       'number');
		copySetting('android.appStartRetryInterval',     'android.adb.start.retryInterval', 'number');
		copySetting('android.emulatorStartTimeout',      'android.emulator.start.timeout',  'number');
		copySetting('android.executables.aapt',          'android.executables.aapt');
		copySetting('android.executables.adb',           'android.executables.adb');
		copySetting('android.executables.aidl',          'android.executables.aidl');
		copySetting('android.executables.dx',            'android.executables.dx');
		copySetting('android.executables.emulator',      'android.executables.emulator');
		copySetting('android.executables.ndkbuild',      'android.executables.ndkbuild');
		copySetting('android.executables.zipalign',      'android.executables.zipalign');
		copySetting('android.ndkPath',                   'android.ndk.searchPaths',         'array');
		copySetting('android.sdkPath',                   'android.sdk.searchPaths',         'array');

		copySetting('genymotion.executables.genymotion', 'android.genymotion.executables.genymotion');
		copySetting('genymotion.executables.player',     'android.genymotion.executables.player');
		copySetting('genymotion.executables.vboxmanage', 'android.virtualbox.executables.vboxmanage');
		copySetting('genymotion.home',                   'android.genymotion.home');
		copySetting('genymotion.path',                   'android.genymotion.searchPaths',  'array');

		copySetting('java.home',                         'java.searchPaths',                'array');

		copySetting('osx.executables.security',          'ios.executables.security');
		copySetting('osx.executables.xcodeSelect',       'ios.executables.xcodeSelect');
		copySetting('paths.xcode',                       'ios.xcode.searchPaths',           'array');

		const home = this.config.get('home');
		if (home) {
			await this.config.save(expandPath(home, 'config.json'));
		}
	}
}
