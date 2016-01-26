import autobind from 'autobind-decorator';
import 'babel-polyfill';
import Connection from './connection';
import Dispatcher, { DispatcherError } from './dispatcher';
import { EventEmitter } from 'events';
import fs from 'fs';
import http from 'http';
import Logger from './logger';
import os from 'os';
import path from 'path';
import Plugin from './plugin';
import resolvePath from 'resolve-path';
import Router from 'koa-router';
import Service from './service';
import { spawn } from 'child_process';
import stream from 'stream';
import WebServer from './webserver';
import 'source-map-support/register';

const pkgJson = require('../package.json');
const appcdEmitter = new EventEmitter;
const appcdDispatcher = new Dispatcher;

/*

global HookEmitter


pass a scoped HookEmitter into the plugin/service


*/


/**
 * Global appcd namespace.
 */
global.appcd = {
	/**
	 * The request dipatcher.
	 * @type {Dispatcher}
	 */
	call: appcdDispatcher.call.bind(appcdDispatcher),

	on: appcdEmitter.on.bind(appcdEmitter),
	logger: new Logger('appcd'),
	Service
};

/**
 * The path to the Appcelerator home directory.
 * @type {String}
 */
const appcDir = path.join(process.env.HOME || process.env.USERPROFILE, '.appcelerator');

/**
 * The path to the appcd config file.
 * @type {String}
 */
const configFile = path.join(appcDir, 'appcd.js');

/**
 * The core server logic that orchestrates the plugin lifecycle and request
 * dispatching.
 *
 * @extends {EventEmitter}
 */
export default class Server extends EventEmitter {
	/**
	 * The web server instance.
	 * @type {WebServer}
	 */
	webserver = null;

	/**
	 * A map of all loaded plugins.
	 * @type {Object}
	 */
	plugins = {};

	/**
	 * Constructs a server instance.
	 *
	 * @param {Object} [opts] - An object containing various options.
	 * @param {Boolean} [opts.daemon=false] - When true, spawns the server as a
	 * background process.
	 * @param {String} [opts.pidFile=~/.appcelerator/appcd.pid] - Path to the
	 * appcd pid file.
	 * @param {Object} [opts.logger] - Logger settings object.
	 * @param {Boolean} [opts.logger.colors=true] - When true, enables colors in
	 * log output when not running in daemon mode.
	 * @param {Boolean} [opts.logger.silent=false] - When true, suppresses all
	 * log output when not running in daemon mode.
	 */
	constructor(opts = {}) {
		super();

		const cfg = this._cfg = fs.existsSync(configFile) && require(configFile) || {};

		cfg.logger || (cfg.logger = {});
		Object.assign(cfg.logger, opts.logger);

		/**
		 * When true, spawns the server as a background process on startup.
		 * @type {Boolean}
		 */
		this.daemon = !!opts.daemon;

		/**
		 * The path to the pid file.
		 * @type {String}
		 */
		this.pidFile = opts.pidFile || path.join(appcDir, 'appcd.pid');

		/**
		 * An array of paths to scan for plugins to load during startup.
		 * @type {Array}
		 */
		this.pluginsPath = [ path.resolve(__dirname, '..', 'plugins'), ...this.config('paths.plugins', []) ];
	}

	/**
	 * Returns a configuration setting.
	 *
	 * @param {String} name - The config option name.
	 * @param {*} [defaultValue] - A default value if the config option is not found.
	 * @returns {*}
	 * @access public
	 */
	config(name, defaultValue) {
		const parts = name.split('.');
		const ns = parts.pop();
		let i = 0;
		let p = parts.length && parts[i++];
		let obj = this._cfg;

		if (p) {
			do {
				if (p in obj) {
					obj = obj[p];
				} else {
					return defaultValue;
				}
			} while (obj && (p = parts[i++]));
		}

		return obj && ns && obj.hasOwnProperty(ns) ? obj[ns] : defaultValue;
	}

	/**
	 * Checks if the appcd server is already running by looking for a pid file,
	 * then checking if that pid is alive.
	 *
	 * @returns {Number|undefined}
	 * @access public
	 */
	isRunning() {
		if (fs.existsSync(this.pidFile)) {
			// found a pid file, check to see if it's stale
			const pid = parseInt(fs.readFileSync(this.pidFile).toString());
			if (pid) {
				try {
					process.kill(pid, 0);
					// server is running
					return pid;
				} catch (e) {
					// stale pid file
					fs.unlinkSync(this.pidFile);
				}
			}
		}
	}

	/**
	 * Starts the server. If the daemon flag is set, subprocess appcd in daemon
	 * mode and suppress output.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	start() {
		return new Promise((resolve, reject) => {
			const pid = this.isRunning();

			// if we found a pid and it's not this process, then we are not the daemon you were looking for
			if (pid && pid !== process.pid) {
				const err = new Error(`Server already running (pid: ${pid})`);
				err.code = 'ALREADY_RUNNING';
				return reject(err);
			}

			if (!pid) {
				// server is not running
				if (this.daemon) {
					this.daemonize();
					resolve(this);
					return;
				}

				if (!this.config('logger.silent')) {
					// we are the server process running in debug mode, so hook up some output
					Logger.pipe(process.stdout, {
						colors: this.config('logger.colors', true),
						flush: true
					});
				}

				// since we are not running as a daemon, we have to write the pid file ourselves
				fs.writeFileSync(this.pidFile, process.pid);
			}

			// at this point, we're either running in debug mode (no pid) or *this* process is the spawned daemon process

			appcd.logger.info(`Appcelerator Daemon v${pkgJson.version}`);
			appcd.logger.info(`Node.js ${process.version} (module api ${process.versions.modules})`);

			// replace the process title to avoid `killall node` taking down the server
			process.title = 'appcd (Appcelerator Daemon)';

			// listen for signals to trigger a shutdown
			process.on('SIGINT', () => this.shutdown().then(() => process.exit(0)));
			process.on('SIGTERM', () => this.shutdown().then(() => process.exit(0)));

			this.webserver = new WebServer({
				hostname: this.config('hostname', '127.0.0.1'),
				port:     this.config('port', 1732)
			});

			this.webserver.on('websocket', socket => {
				const address = appcd.logger.highlight(socket._socket.remoteAddress);
				appcd.logger.info('WebSocket %s: connect', address);

				socket.on('message', message => {
					let req;

					try {
						req = JSON.parse(message);
						if (!req || typeof req !== 'object') { throw new Error('invalid request object'); }
						if (!req.version) { throw new Error('invalid request object, missing version'); }
						if (!req.path)    { throw new Error('invalid request object, missing path'); }
						if (!req.id)      { throw new Error('invalid request object, missing id'); }

						switch (req.version) {
							case '1.0':
								const conn = new Connection({
									socket,
									id: req.id
								});

								const startTime = new Date;

								appcdDispatcher.call(req.path, { conn, data: req.data || {} })
									.then(result => {
										const p = result && result instanceof Promise ? result : Promise.resolve(result);
										return p.then(result => {
											if (result) {
												conn.send(result).then(conn.close);
											}
											appcd.logger.info(
												'WebSocket %s: %s %s %s',
												address,
												appcd.logger.lowlight(req.path),
												appcd.logger.ok('200'),
												appcd.logger.highlight((new Date - startTime) + 'ms')
											);
										});
									})
									.catch(err => {
										const status = err.status && Dispatcher.statusCodes[String(err.status)] ? err.status : 500;
										const message = (err.status && Dispatcher.statusCodes[String(err.status)] || Dispatcher.statusCodes['500']) + ': ' + (err.message || err.toString());
										const delta = new Date - startTime;
										appcd.logger.error(
											'WebSocket %s: %s',
											address,
											appcd.logger.alert(req.path + ' ' + status + ' ' + delta + 'ms - ' + message)
										);
										socket.send(JSON.stringify({
											id: req.id,
											status: err.status || 500,
											error: message
										}));
									});

								break;

							default:
								throw new Error(`Unsupported version "${req.version}"`);
						}
					} catch (err) {
						appcd.logger.error('Bad request:', err);
						socket.send(JSON.stringify({
							status: 400,
							error: 'Bad request: ' + err.toString()
						}));
					}
				});

				socket.on('close', () => {
					appcd.logger.info('WebSocket %s: disconnect', address);
				});
			});

			Promise.resolve()
				.then(this.initHandlers)
				.then(this.loadPlugins)
				.then(this.webserver.listen)
				.then(() => {
					appcdEmitter.emit('appcd:start');
					resolve();
				})
				.catch(reject);
		});
	}

	/**
	 * Spawns the child appcd process in daemon mode.
	 *
	 * @access private
	 */
	daemonize() {
		const node = process.env.NODE_EXEC_PATH || process.execPath;
		const args = [];

		// if the user has more than 2GB of RAM, set the max memory to 3GB or 75% of the total memory
		const totalMem = Math.floor(os.totalmem() / 1e6);
		if (totalMem * 0.75 > 1500) {
			args.push('--max_old_space_size=' + Math.min(totalMem * 0.75, 3000));
		}

		args.push(path.resolve(__dirname, 'cli.js'));
		args.push('start');

		const child = spawn(node, args, {
			detached: true,
			stdio: 'ignore'
		});
		fs.writeFileSync(this.pidFile, child.pid);
		child.unref();
	}

	/**
	 * Helper function that returns the server status.
	 *
	 * @returns {String}
	 * @access private
	 */
	getStatus() {
		let cache = this._statusCache;

		if (!cache) {
			// init the cache
			cache = this._statusCache = {
				appcd: {
					version:  pkgJson.version,
					pid:      process.pid,
					execPath: process.execPath,
					execArgv: process.execArgv,
					argv:     process.argv
				},
				node: {
					version:  process.version.replace(/^v/, ''),
					versions: process.versions
				},
				system: {
					platform: process.platform,
					arch:     process.arch,
					cpus:     os.cpus().length,
					hostname: os.hostname()
				}
			};
		}

		// refresh the cache
		cache.appcd.uptime   = process.uptime();
		cache.appcd.env      = process.env;
		cache.appcd.plugins  = Object.entries(this.plugins).map(([name, plugin]) => {
			return {
				name:    name,
				path:    plugin.path,
				version: plugin.version,
				status:  plugin.getStatus()
			};
		});
		cache.system.loadavg = os.loadavg();
		cache.system.memory  = {
			usage: process.memoryUsage(),
			free:  os.freemem(),
			total: os.totalmem()
		};

		return JSON.stringify(cache, null, '  ');
	}

	/**
	 * Wires up core request handlers.
	 *
	 * @access private
	 */
	@autobind
	initHandlers() {
		this.webserver.router.get('/appcd/status', (ctx, next) => {
			ctx.response.type = 'json';
			ctx.body = this.getStatus();
		});

		appcdDispatcher.register('/appcd/status', ctx => {
			const timer = setInterval(() => {
				try {
					ctx.conn.write(this.getStatus());
				} catch (e) {
					// connection was terminated, stop sending data
					clearInterval(timer);
				}
			}, Math.max(ctx.data.interval || 1000, 0));
		});

		appcdDispatcher.register('/appcd/logcat', ctx => {
			Logger.pipe(ctx.conn, {
				colors: !!ctx.data.colors,
				flush: true
			});
		});
	}

	/**
	 * Detects, loads, and initializes plugins.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	@autobind
	loadPlugins() {
		// build list of all potential plugin directories
		const pluginPaths = [];
		this.pluginsPath.forEach(dir => {
			if (fs.existsSync(path.join(dir, 'package.json'))) {
				pluginPaths.push(dir);
			} else {
				fs.readdirSync(dir).forEach(name => {
					if (fs.existsSync(path.join(dir, name, 'package.json'))) {
						pluginPaths.push(path.join(dir, name));
					}
				});
			}
		});

		return Promise.all(pluginPaths.map(pluginPath => {
			return new Promise((resolve, reject) => {
				try {
					let pkgJson = JSON.parse(fs.readFileSync(path.join(pluginPath, 'package.json')));
					if (!pkgJson || typeof pkgJson !== 'object') {
						pkgJson = {};
					}

					const main = pkgJson.main || 'index.js';
					let file = main;
					if (!/\.js$/.test(file)) {
						file += '.js';
					}
					file = resolvePath(pluginPath, file);
					if (!fs.existsSync(file)) {
						throw new Error(`Unable to find main file: ${main}`);
					}

					const module = require(file);
					const ServiceClass = module && module.__esModule ? module.default : module;

					if (!ServiceClass || typeof ServiceClass !== 'function' || !(ServiceClass.prototype instanceof Service)) {
						throw new Error(`Plugin does not export a service`);
					}

					const name = pkgJson.name || path.basename(pluginPath);

					if (this.plugins[name]) {
						throw new Error('Already loaded a plugin with the same name: ' + this.plugins[name].path);
					}

					const plugin = this.plugins[name] = new Plugin({
						name,
						path: pluginPath,
						ServiceClass,
						pkgJson,
						appcdEmitter,
						appcdDispatcher,
						server: this
					});

					plugin.init().then(resolve, reject);
				} catch (e) {
					appcd.logger.error(`Failed to load plugin ${pluginPath}`);
					appcd.logger.error(e.stack || e.toString());
					appcd.logger.error(`Skipping ${pluginPath}`);
					resolve();
				}
			});
		}));
	}

	/**
	 * Shutsdown the server including the web server and websocket server. All
	 * connections will be terminated after 30 seconds. Lastly, the pid file
	 * is removed.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	@autobind
	shutdown() {
		return new Promise((resolve, reject) => {
			appcd.logger.info('Shutting down server gracefully');
			this.webserver
				.close()
				.then(() => {
					return Promise.all(Object.values(this.plugins).map(plugin => { return plugin.shutdown(); }));
				})
				.then(() => {
					appcd.logger.info('Removing ' + appcd.logger.highlight(this.pidFile));
					fs.unlinkSync(this.pidFile);
					resolve();
				})
				.catch(reject);
		});
	}

	/**
	 * Full stops the server. If it doesn't exit in 10 seconds, we shoot it in
	 * the head.
	 *
	 * @param {Boolean} kill - Force kill the server.
	 * @returns {Promise}
	 * @access public
	 */
	stop(kill) {
		return new Promise((resolve, reject) => {
			const pid = this.isRunning();
			const self = this;

			if (!pid) {
				return resolve(this);
			}

			process.kill(pid, kill ? 'SIGKILL' : 'SIGTERM');

			const timeout = 10000;
			const interval = 500;
			let countdown = kill ? -1 : timeout / interval;

			function check() {
				try {
					process.kill(pid, countdown === 0 ? 'SIGKILL' : 0);
					if (countdown < 0) {
						return reject(new Error(`Failed to kill server (pid: ${pid})`));
					}
					countdown--;
					setTimeout(check, interval);
				} catch (e) {
					// server shutdown successfully
					resolve(self);
				}
			}

			setTimeout(check, interval);
		});
	}
}
