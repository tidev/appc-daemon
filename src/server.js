import Analytics from './analytics';
import autobind from 'autobind-decorator';
import 'babel-polyfill';
import Connection from './connection';
import Dispatcher, { DispatcherError } from './dispatcher';
import { existsSync } from './util';
import fs from 'fs';
import { gawk } from 'gawk';
import { HookEmitter } from 'hook-emitter';
import http from 'http';
import Logger from './logger';
import { mergeDeep, expandPath } from './util';
import mkdirp from 'mkdirp';
import os from 'os';
import path from 'path';
import Plugin from './plugin';
import resolvePath from 'resolve-path';
import Router from 'koa-router';
import Service from './service';
import { fork, spawn } from 'child_process';
import stream from 'stream';
import WebServer from './webserver';
import 'source-map-support/register';

const appcdDispatcher = new Dispatcher;
const appcdEmitter = new HookEmitter;

/**
 * Global appcd namespace.
 */
global.appcd = {
	/**
	 * The request dipatcher call() function.
	 * @type {Function}
	 */
	call: appcdDispatcher.call.bind(appcdDispatcher),

	/**
	 * The global event emitter on() function.
	 * @type {Function}
	 */
	on: appcdEmitter.on.bind(appcdEmitter),

	/**
	 * The global logger instance.
	 * @type {Function}
	 */
	logger: new Logger('appcd'),

	/**
	 * The service base class.
	 * @type {Service}
	 */
	Service,

	/**
	 * Exits the process.
	 * @type {Function}
	 */
	exit: process.exit
};

/**
 * The core server logic that orchestrates the plugin lifecycle and request
 * dispatching.
 */
export default class Server {
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
	 * @param {Object} [opts.analytics] - Analytics options.
	 * @param {Object} [opts.appcd] - appcd options.
	 * @param {String} [opts.appcd.configFile=~/.appcelerator/appcd.js] - The path to the config file to load.
	 * @param {Boolean} [opts.appcd.daemonize=false] - When true, spawns the server as a background process.
	 * @param {String} [opts.appcd.pidFile=~/.appcelerator/appcd.pid] - Path to the daemon's pid file.
	 * @param {Object} [opts.logger] - Logger options.
	 * @param {Object} [opts.network] - Network options.
	 * @param {Object} [opts.paths] - An object of path names to paths.
	 * @param {String|Array<String>} [opts.paths.plugins] - One or more paths to scan for plugins.
	 * appcd pid file.
	 */
	constructor(opts = {}) {
		const pkgJson = require('../package.json');

		const appcHome = opts.appc && opts.appc.home || '~/.appcelerator';

		// init the default settings
		const cfg = {
			analytics: {
				enabled: true,
				eventsDir: path.join(appcHome, 'appcd/events'),
				url: 'https://api.appcelerator.net/p/v2/partner-track'
			},
			appc: {
				home: appcHome
			},
			appcd: {
				allowExit: true,
				configFile: path.join(appcHome, 'appcd/config.js'),
				daemonize: false,
				guid: 'ea327577-858f-4d31-905e-fa670f50ef48',
				pidFile: path.join(appcHome, 'appcd/appcd.pid'),
				skipPluginCheck: false,
				version: pkgJson.version
			},
			environment: {
				name: 'production'
			},
			logger: {
				colors: true,
				silent: false
			},
			network: {
				proxyUrl: null
			},
			paths: {
				plugins: []
			}
		};

		// override config with constructor options
		mergeDeep(cfg, opts);

		// force set the pkgJson so that it can't be overwritten
		cfg.appcd.pkgJson = pkgJson;

		// load the config file
		const configFile = expandPath(cfg.appcd.configFile);
		if (!/\.js$/.test(configFile)) {
			throw new Error('Config file must be a JavaScript file.');
		} else if (existsSync(configFile)) {
			Object.assign(cfg, require(configFile));
		} else if (opts.appcd && opts.appcd.configFile) {
			throw new Error(`Specified config file not found: ${opts.appcd.configFile}.`);
		}

		this._cfg = Object.freeze(cfg);
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
		if (name) {
			return name.split('.').reduce((cfg, prop) => {
				if (typeof cfg === 'object' && cfg !== null) {
					return cfg.hasOwnProperty(prop) ? cfg[prop] : defaultValue;
				}
			}, this._cfg);
		}

		return this._cfg;
	}

	/**
	 * Checks if the appcd server is already running by looking for a pid file,
	 * then checking if that pid is alive.
	 *
	 * @returns {Number|undefined}
	 * @access public
	 */
	isRunning() {
		const pidFile = expandPath(this.config('appcd.pidFile'));
		if (existsSync(pidFile)) {
			// found a pid file, check to see if it's stale
			const pid = parseInt(fs.readFileSync(pidFile).toString());
			if (pid) {
				try {
					process.kill(pid, 0);
					// server is running
					return pid;
				} catch (e) {
					// stale pid file
					fs.unlinkSync(pidFile);
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
		if (!this.daemonize) {
			// enable long stack traces in debug mode
			require('longjohn');
		}

		if (!this.config('appcd.allowExit')) {
			// hijack process.exit()
			Object.defineProperty(process, 'exit', {
				value: function () {
					const stack = new Error().stack;
					appcd.logger.error('process.exit() is not allowed');
					appcd.logger.error(stack);
				}
			});
		}

		return Promise.resolve()
			.then(this.loadPlugins)
			.then(() => {
				const pid = this.isRunning();

				// if we found a pid and it's not this process, then we are not the daemon you were looking for
				if (pid && pid !== process.pid) {
					const err = new Error(`Server already running (pid: ${pid})`);
					err.code = 'ALREADY_RUNNING';
					throw err;
				}

				if (!pid) {
					// server is not running

					// check if we should daemonize
					if (this.config('appcd.daemonize')) {
						return this.daemonize().then(child => this);
					}

					if (!this.config('logger.silent')) {
						// we are the server process running in debug mode, so hook up some output
						Logger.pipe(process.stdout, {
							colors: this.config('logger.colors', true),
							flush: true
						});
					}

					const pidFile = expandPath(this.config('appcd.pidFile'));
					const dir = path.dirname(pidFile);
					mkdirp.sync(dir);

					// since we are not running as a daemon, we have to write the pid file ourselves
					fs.writeFileSync(pidFile, process.pid);
				}

				//
				// at this point, we're either running in debug mode (no pid) or *this* process is the spawned daemon process
				//

				appcd.logger.info(`Appcelerator Daemon v${this.config('appcd.version')}`);
				appcd.logger.info(`Environment: ${this.config('environment.name')}`);
				appcd.logger.info(`Node.js ${process.version} (module api ${process.versions.modules})`);

				// replace the process title to avoid `killall node` taking down the server
				process.title = 'appcd (Appcelerator Daemon)';

				// listen for signals to trigger a shutdown
				process.on('SIGINT', () => this.shutdown().then(() => appcd.exit(0)));
				process.on('SIGTERM', () => this.shutdown().then(() => appcd.exit(0)));

				return Promise.resolve()
					.then(this.initAnalytics)
					.then(this.initStatusMonitor)
					.then(this.initHandlers)
					.then(this.initWebServer)
					.then(() => appcdEmitter.emit('appcd:start'))
					.then(() => appcdEmitter.emit('analytics:event', {
						type: 'appcd.server.start'
					}));
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
		// if the `plugins` directory in the appc home directory doesn't exist,
		// then create it
		const appcHomePluginDir = expandPath(this.config('appc.home'), 'appcd/plugins');
		mkdirp.sync(appcHomePluginDir);

		// build list of all potential plugin directories
		const pathsToCheck = [
			path.resolve(__dirname, '..', 'plugins'),
			appcHomePluginDir,
			...this.config('paths.plugins', [])
		];
		const pluginPaths = [];

		pathsToCheck.forEach(dir => {
			dir = expandPath(dir);
			if (!pluginPaths.includes(dir) && existsSync(dir)) {
				if (existsSync(path.join(dir, 'package.json'))) {
					pluginPaths.push(dir);
				} else {
					fs.readdirSync(dir).forEach(name => {
						if (existsSync(path.join(dir, name, 'package.json'))) {
							pluginPaths.push(path.join(dir, name));
						}
					});
				}
			}
		});

		/**
		 * For each plugin path, check if it contains a valid plugin:
		 *  - must have a package.json
		 *  - must have a main file or index.js
	  	 *  - main file must export a service that extends appcd.Service
		 *
		 * We test each plugin path in a subprocess since we don't want to try to
		 * load a plugin that breaks the server due to some bad syntax, pollute
		 * global namespace, or load dependencies that consume unrecoverable memory.
		 */
		return Promise.all(pluginPaths.map(pluginPath => new Promise((resolve, reject) => {
			let pkgJson;
			let mainFile;

			// we do not want to return this promise chain since it could contain
			// an error and bad plugins are ingored, so that's why we wrap it with
			// another promise
			Promise.resolve()
				.then(() => {
					pkgJson = JSON.parse(fs.readFileSync(path.join(pluginPath, 'package.json')));
					if (!pkgJson || typeof pkgJson !== 'object') {
						pkgJson = {};
					}

					const main = pkgJson.main || 'index.js';
					mainFile = main;
					if (!/\.js$/.test(mainFile)) {
						mainFile += '.js';
					}

					mainFile = resolvePath(pluginPath, mainFile);
					if (!existsSync(mainFile)) {
						throw new Error(`Unable to find main file: ${main}`);
					}
				})
				.then(() => {
					if (!this.config('appcd.skipPluginCheck')) {
						return this.spawnNode([ path.join(__dirname, 'check-plugin.js'), mainFile ]);
					}
				})
				.then(child => {
					if (child) {
						return new Promise((resolve, reject) => {
							let output = '';
							child.stdout.on('data', data => output += data.toString());
							child.stderr.on('data', data => output += data.toString());
							child.on('close', code => {
								if (code === 3) {
									appcd.logger.warn(`Plugin "${pluginPath}" does not export a service, skipping`);
									resolve();
								} else if (code > 0) {
									reject(`Check plugin exited with code ${code}: ${output.trim()}`);
								} else {
									resolve(true);
								}
							});
						});
					}
				})
				.then(isService => {
					const module = require(mainFile);
					const ServiceClass = module && module.__esModule ? module.default : module;

					// double check that this plugin exports a service
					// check-plugin.js should have already done this for us, but better safe than sorry
					if (!ServiceClass || typeof ServiceClass !== 'function' || !(ServiceClass.prototype instanceof Service)) {
						throw new Error('Plugin does not export a service');
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

					return plugin.init();
				})
				.then(resolve)
				.catch(err => {
					appcd.logger.error(`Failed to load plugin ${pluginPath}`);
					appcd.logger.error(err.stack || err.toString());
					appcd.logger.error(`Skipping ${pluginPath}`);
					resolve();
				});
		})));
	}

	/**
	 * Spawns the child appcd process in daemon mode.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	daemonize() {
		return appcdEmitter.hook('appcd:daemonize', (args, opts) => {
			return this.spawnNode(args, opts)
				.then(child => {
					fs.writeFileSync(expandPath(this.config('appcd.pidFile')), child.pid);
					child.unref();
				});
		})([ path.resolve(__dirname, 'cli.js'), 'start', '--config-file', this.config('appcd.configFile') ], {
			detached: true,
			stdio: 'ignore'
		});
	}

	/**
	 * Spawns a new node process with the specfied args.
	 *
	 * @param {Array} [args] - An array of arguments to pass to the subprocess.
	 * @param {Object} [opts] - Spawn options.
	 * @returns {Promise}
	 * @access private
	 */
	spawnNode(args = [], opts = {}) {
		const node = process.env.NODE_EXEC_PATH || process.execPath;
		const v8args = [];

		// if the user has more than 2GB of RAM, set the max memory to 3GB or 75% of the total memory
		const totalMem = Math.floor(os.totalmem() / 1e6);
		if (totalMem * 0.75 > 1500) {
			v8args.push('--max_old_space_size=' + Math.min(totalMem * 0.75, 3000));
		}

		return Promise.resolve(
			spawn(
				process.env.NODE_EXEC_PATH || process.execPath,
				[v8args, ...args],
				opts
			)
		);
	}

	/**
	 * Initializes the analytics system.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	@autobind
	initAnalytics() {
		return appcdEmitter
			.hook('appcd:init.analytics', opts => {
				const analytics = new Analytics(opts);
				appcd.on('analytics:event', analytics.newEvent);
				return analytics;
			})({
				enabled:   this.config('analytics.enabled'),
				eventsDir: this.config('analytics.eventsDir'),
				url:       this.config('analytics.url')
			})
			.then(analytics => {
				this.analytics = analytics;
			});
	}

	/**
	 * Initializes the server status system.
	 */
	@autobind
	initStatusMonitor() {
		return appcdEmitter
			.hook('appcd:init.status.monitor', () => {
				this.status = gawk({
					appcd: {
						version:  this.config('appcd.version'),
						pid:      process.pid,
						execPath: process.execPath,
						execArgv: process.execArgv,
						argv:     process.argv,
						env:      process.env
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
				});

				const refresh = () => {
					this.status.mergeDeep({
						appcd: {
							uptime: process.uptime(),
							plugins: Object.entries(this.plugins).map(([name, plugin]) => {
								return {
									name:    name,
									path:    plugin.path,
									version: plugin.version,
									status:  plugin.getStatus()
								};
							})
						},
						system: {
							loadavg: os.loadavg(),
							memory: {
								usage: process.memoryUsage(),
								free:  os.freemem(),
								total: os.totalmem()
							}
						}
					});
				};

				refresh();
				setInterval(refresh, 1000);

				return this.status;
			})();
	}

	/**
	 * Wires up core request handlers.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	@autobind
	initHandlers() {
		return appcdEmitter.hook('appcd:init.handlers', () => {
			appcdDispatcher.register(/\/appcd\/status(\/.*)?/, ctx => {
				const filter = ctx.params[0] && ctx.params[0].replace(/^\//, '').split('/') || undefined;
				const node = this.status.get(filter);
				if (!node) {
					throw new Error('Invalid request: ' + ctx.path);
				}
				ctx.conn.write(node.toJSON(true));
				const off = node.watch(evt => ctx.conn.write(evt.source.toJSON(true)));
				ctx.conn.on('close', off);
				ctx.conn.on('error', off);
			});

			appcdDispatcher.register('/appcd/logcat', ctx => {
				Logger.pipe(ctx.conn, {
					colors: !!ctx.data.colors,
					flush: true
				});
			});
		})();
	}

	/**
	 * Wires up core request handlers.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	@autobind
	initWebServer() {
		appcdEmitter.hook('appcd:init.webserver', opts => {
			const webserver = this.webserver = new WebServer(opts);

			webserver.on('websocket', socket => {
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

			webserver.router.get('/appcd/status/:filter?', (ctx, next) => {
				const filter = ctx.params[0] && ctx.params[0].replace(/^\//, '').split('/') || undefined;
				const node = this.status.get(filter);
				if (!node) {
					return next();
				}

				ctx.response.type = 'json';
				ctx.body = node.toJSON(true);
			});

			Object.values(this.plugins).forEach(plugin => {
				webserver.router.use('/' + plugin.namespace, plugin.router.routes());
			});

			return this.webserver.listen();
		})({
			hostname: this.config('hostname', '127.0.0.1'),
			port:     this.config('port', 1732)
		});
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
					const pidFile = expandPath(this.config('appcd.pidFile'));
					appcd.logger.info('Removing ' + appcd.logger.highlight(pidFile));
					fs.unlinkSync(pidFile);
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
