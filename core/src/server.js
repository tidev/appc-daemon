import Analytics from './analytics';
import autobind from 'autobind-decorator';
import 'babel-polyfill';
import Connection from './connection';
import Dispatcher from './dispatcher';
import fs from 'fs';
import { gawk, GawkUndefined } from 'gawk';
import { getActiveHandles } from 'double-stack';
import { getDefaultConfig, getEnvironmentConfig } from './defaults';
import { HookEmitter } from 'hook-emitter';
import humanize from 'humanize';
import Logger from './logger';
import mkdirp from 'mkdirp';
import os from 'os';
import path from 'path';
import pidusage from 'pidusage';
import PluginManager from './plugin-manager';
import pluralize from 'pluralize';
import Service from './service';
import * as util from './util';
import WebServer from './webserver';

const appcdDispatcher = new Dispatcher;
const appcdEmitter = new HookEmitter;

/**
 * Global appcd namespace.
 */
Object.defineProperty(global, 'appcd', {
	value: {
		/**
		 * The global request dipatcher call() function.
		 * @param {String} path - The dispatch path to request.
		 * @param {Object} [data={}] - An optional data payload to send.
		 * @returns {Promise}
		 */
		call: appcdDispatcher.call,

		/**
		 * The global event emitter on() function. Plugins and other modules can use
		 * this to listen for events and hooks from all `Server` instances.
		 * @param {String} event - One or more space-separated event names to add the listener to.
		 * @param {Function} listener - A function to call when the event is emitted.
		 * @returns {HookEmitter}
		 */
		on: appcdEmitter.on.bind(appcdEmitter),

		/**
		 * The global logger instance. All appc daemon code should use this to log
		 * messages. Daemon plugins should use the namespaced logger that is apart
		 * of the `Service` base class.
		 * @type {Object}
		 */
		logger: new Logger('appcd'),

		/**
		 * The service base class.
		 * @type {Service}
		 */
		Service,

		/**
		 * Exits the process. If any server instance has `allowExit` set to `false`,
		 * then `process.exit()` will become a no-op and you will have to call
		 * `appcd.exit()` to exit. This is a safety feature so that a plugin doesn't
		 * try to take down the daemon.
		 * @type {Function}
		 */
		exit: process.exit
	}
});

/**
 * The core server logic that orchestrates the plugin lifecycle and request
 * dispatching.
 */
export default class Server extends HookEmitter {
	/**
	 * The web server instance.
	 * @type {WebServer}
	 */
	webserver = null;

	/**
	 * The plugin manager.
	 * @type {Object}
	 */
	pluginMgr = null;

	/**
	 * The count of the Node process uptime when the server is started.
	 * @type {Number}
	 */
	startupTime = 0;

	/**
	 * Constructs a server instance, loads the config file, and initializes the
	 * analytics system.
	 *
	 * @param {Object} [opts] - An object containing various options.
	 * @param {Object} [opts.analytics] - Analytics options.
	 * @param {Object} [opts.appcd] - appcd options.
	 * @param {String} [opts.appcd.configFile=~/.appcelerator/appcd.js] - The path to the config file to load.
	 * @param {Boolean} [opts.appcd.daemonize=false] - When true, spawns the server as a background process.
	 * @param {String} [opts.appcd.pidFile=~/.appcelerator/appcd.pid] - Path to the daemon's pid file.
	 * @param {String} [opts.environment] - The environment to use. If set, it must be "production" or "preproduction".
	 * @param {Object} [opts.logger] - Logger options.
	 * @param {Object} [opts.network] - Network options.
	 * @param {Object} [opts.paths] - An object of path names to paths.
	 * @param {String|Array<String>} [opts.paths.plugins] - One or more paths to scan for plugins.
	 */
	constructor(opts = {}) {
		super();

		// initialize with the default config
		const cfg = util.mergeDeep({}, getDefaultConfig());

		// load the config file
		const defaultConfigFile  = cfg.appcd.configFile;
		const optsConfigFile     = opts.appcd && opts.appcd.configFile;
		const expandedConfigFile = util.expandPath(optsConfigFile || defaultConfigFile);
		if (optsConfigFile) {
			if (!/\.js(on)?$/.test(optsConfigFile)) {
				throw new Error('Config file must be a JavaScript or JSON file.');
			}
			if (!util.existsSync(expandedConfigFile)) {
				throw new Error(`Specified config file not found: ${optsConfigFile}.`);
			}
		}
		const savedConfig = util.existsSync(expandedConfigFile) && require(expandedConfigFile) || {};

		// merge in the default environment settings, config file settings, and
		// constructor settings
		util.mergeDeep(cfg, getEnvironmentConfig(savedConfig.environment));
		util.mergeDeep(cfg, savedConfig);
		util.mergeDeep(cfg, opts);

		// set the actual config file that was loaded
		cfg.appcd.configFile = optsConfigFile || defaultConfigFile;

		cfg.machineId = null;

		// gawk the config so that we can monitor it at runtime
		this.cfg = gawk(cfg);

		// link our hook emitter to the global hook emitter so we can broadcast
		// our events and hooks to anything
		this.link(appcdEmitter);

		// if the `plugins` directory in the appc home directory doesn't exist,
		// then create it
		const appcHomePluginDir = util.expandPath(this.config('appc.home'), 'appcd/plugins');
		mkdirp.sync(appcHomePluginDir);

		this.pluginMgr = new PluginManager({
			appcdDispatcher,
			pluginPaths: [
				path.resolve(__dirname, '..', 'plugins'),
				appcHomePluginDir,
				...this.config('paths.plugins', [])
			],
			server: this
		});

		// initialize the analytics system
		this.analytics = new Analytics(this);
		this.on('analytics:event', data => this.analytics.emit('event', data));
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
		if (!name) {
			return this.cfg.toJS();
		}

		const value = this.cfg.get(name.split('.'));
		if (value instanceof GawkUndefined) {
			return defaultValue;
		}
		return value.toJS();
	}

	/**
	 * Checks if the appcd server is already running by looking for a pid file,
	 * then checking if that pid is alive.
	 *
	 * @returns {Number|undefined}
	 * @access public
	 */
	isRunning() {
		const pidFile = util.expandPath(this.config('appcd.pidFile'));
		if (util.existsSync(pidFile)) {
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
	@autobind
	start() {
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

		appcd.logger.info(`Appcelerator Daemon v${this.config('appcd.version')}`);
		appcd.logger.info(`Config file: ${appcd.logger.highlight(this.config('appcd.configFile'))}`);
		appcd.logger.info(`Environment: ${appcd.logger.highlight(this.config('environment'))}`);
		appcd.logger.info(`Node.js ${process.version} (module v${process.versions.modules})`);

		// replace the process title to avoid `killall node` taking down the server
		process.title = 'appcd';

		return Promise.resolve()
			.then(this.init)
			.then(this.analytics.init)
			.then(this.pluginMgr.load)
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

					const pidFile = util.expandPath(this.config('appcd.pidFile'));
					const dir = path.dirname(pidFile);
					mkdirp.sync(dir);

					// since we are not running as a daemon, we have to write the pid file ourselves
					fs.writeFileSync(pidFile, process.pid);
				}

				//
				// at this point, we're either running in debug mode (no pid) or *this* process is the spawned daemon process
				//

				// listen for signals to trigger a shutdown
				process.on('SIGINT', () => this.shutdown().then(() => appcd.exit(0)));
				process.on('SIGTERM', () => this.shutdown().then(() => appcd.exit(0)));

				this.startupTime = process.uptime();

				return Promise.resolve()
					.then(this.initStatusMonitor)
					.then(this.initHandlers)
					.then(this.initWebServer)
					.then(() => {
						const status = this.status.toJS();
						delete status.system.loadavg;
						delete status.system.hostname;
						return this.emit('analytics:event', {
							type: 'appcd.server.start',
							appcd: {
								version:  status.appcd.version,
								execPath: status.appcd.execPath,
								execArgv: status.appcd.execArgv,
								argv:     status.appcd.argv,
								plugins:  status.appcd.plugins
							},
							node: status.node,
							system: status.system
						});
					})
					.then(() => this.emit('appcd:start'))
					.then(() => this);
			});
	}

	/**
	 * Initializes the server in preparation for start.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	@autobind
	init() {
		const appcdHome = util.expandPath(this.config('appcd.home'));
		mkdirp.sync(appcdHome);

		appcdDispatcher.register('/appcd/config/:key*', this.configRouteHandler);

		return Promise.resolve()
			.then(this.initMachineId);
	}

	/**
	 * Config route handler for both the dispatcher and web server.
	 *
	 * @param {Context} ctx - The Koa request context.
	 * @access private
	 */
	@autobind
	configRouteHandler(ctx) {
		const filter = ctx.params.key && ctx.params.key.split('/') || undefined;
		const node = this.cfg.get(filter);
		if (!node) {
			throw new Error('Invalid request: ' + ctx.path);
		}
		ctx.body = node.toJSON(true);
	}

	/**
	 * Determines the machine's unique identifier and stores the value in the
	 * appcd server config.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	@autobind
	initMachineId() {
		const midFile = util.expandPath(this.config('appcd.home'), '.mid');

		return Promise.resolve()
			.then(() => new Promise((resolve, reject) => {
				let promise = Promise.resolve();

				// if we're running on OS X or Windows, then get the operating system's
				// unique identifier
				if (process.platform === 'darwin') {
					promise = util.run('ioreg', ['-ard1', '-c', 'IOPlatformExpertDevice'])
						.then(result => {
							const plist = require('simple-plist');
							const json = plist.parse(result.stdout)[0];
							return json && util.sha1(json.IOPlatformUUID);
						});
				} else if (/^win/.test(process.platform)) {
					promise = util.run('reg', ['query', 'HKLM\\Software\\Microsoft\\Cryptography', '/v', 'MachineGuid'])
						.then(result => {
							const m = result.stdout.trim().match(/MachineGuid\s+REG_SZ\s+(.+)/i);
							if (m) {
								return util.sha1(m[1]);
							}
						});
				}

				promise
					.then(resolve)
					// squeltch errors
					.catch(err => resolve());
			}))
			.then(machineId => {
				if (machineId) {
					return machineId;
				}

				// try to generate the machine id based on the mac address
				return new Promise((resolve, reject) => {
					const macaddress = require('macaddress');
					macaddress.one((err, mac) => resolve(!err && mac ? util.sha1(mac) : null));
				});
			})
			.then(machineId => {
				if (machineId) {
					return machineId;
				}

				// see if we have a cached machine id
				let mid = null;
				if (util.existsSync(midFile)) {
					mid = fs.readFileSync(midFile).toString().split('\n')[0];
					if (!mid || mid.length !== 40) {
						mid = null;
					}
				}

				// generate a random machine id
				if (!mid) {
					mid = util.randomBytes(20);
				}

				return mid;
			})
			.then(machineId => {
				appcd.logger.debug(`Machine ID: ${appcd.logger.highlight(machineId)}`);
				fs.writeFileSync(midFile, machineId);
				this.cfg.set('machineId', machineId);
			});
	}

	/**
	 * Spawns the child appcd process in daemon mode.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	daemonize() {
		return this
			.hook('appcd:daemonize', (args, opts) => {
				return util.spawnNode(args, opts)
					.then(child => {
						fs.writeFileSync(util.expandPath(this.config('appcd.pidFile')), child.pid);
						child.unref();
					});
			})([ this.config('appcd.startScript', path.resolve(__dirname, 'start-server.js')), '--daemonize', '--config-file', this.config('appcd.configFile') ], {
				detached: true,
				nodePath: this.config('appcd.nodePath'),
				stdio: 'ignore'
			});
	}

	/**
	 * Initializes the server status system.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	@autobind
	initStatusMonitor() {
		return this
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
					pidusage.stat(process.pid, (err, stat) => {
						this.status.mergeDeep({
							appcd: {
								cpuUsage: err ? null : stat.cpu,
								plugins: this.pluginMgr.status(),
								uptime: process.uptime() - this.startupTime
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
					});
				};

				refresh();

				let refreshTimer = setInterval(refresh, 1000);

				const logger      = new Logger('appcd:status');
				let prevCPUUsage  = null;
				let prevMemory    = null;
				let logTimer      = setInterval(() => {
					const currentCPUUsage = this.status.get(['appcd', 'cpuUsage']).toJS();
					let cpuUsage = '';
					if (currentCPUUsage && prevCPUUsage) {
						if (currentCPUUsage < prevCPUUsage) {
							cpuUsage = logger.ok(('\u2193' + currentCPUUsage.toFixed(1) + '%').padStart(7));
						} else if (currentCPUUsage > prevCPUUsage) {
							cpuUsage = logger.alert(('\u2191' + currentCPUUsage.toFixed(1) + '%').padStart(7));
						}
					}
					if (!cpuUsage) {
						cpuUsage = logger.note((' ' + (currentCPUUsage ? currentCPUUsage.toFixed(1) : '?') + '%').padStart(7));
					}
					prevCPUUsage = currentCPUUsage;

					const currentMemoryUsage = this.status.get(['system', 'memory', 'usage']).toJS();
					const heapUsed = humanize.filesize(currentMemoryUsage.heapUsed).toUpperCase();
					const heapTotal = humanize.filesize(currentMemoryUsage.heapTotal).toUpperCase();
					const rss = humanize.filesize(currentMemoryUsage.rss).toUpperCase();
					let heapUsage = logger.note(heapUsed.padStart(11)) + ' /' + logger.note(heapTotal.padStart(11));
					let rssUsage = logger.note(rss.padStart(11));

					if (prevMemory) {
						if (currentMemoryUsage.heapUsed < prevMemory.heapUsed) {
							heapUsage = logger.ok(('\u2193' + heapUsed).padStart(11));
						} else if (currentMemoryUsage.heapUsed > prevMemory.heapUsed) {
							heapUsage = logger.alert(('\u2191' + heapUsed).padStart(11));
						} else {
							heapUsage = logger.note(heapUsed.padStart(11));
						}
						heapUsage += ' /';
						if (currentMemoryUsage.heapTotal < prevMemory.heapTotal) {
							heapUsage += logger.ok(('\u2193' + heapTotal).padStart(11));
						} else if (currentMemoryUsage.heapTotal > prevMemory.heapTotal) {
							heapUsage += logger.alert(('\u2191' + heapTotal).padStart(11));
						} else {
							heapUsage += logger.note(heapTotal.padStart(11));
						}

						if (currentMemoryUsage.rss < prevMemory.rss) {
							rssUsage = logger.ok(('\u2193' + rss).padStart(11));
						} else if (currentMemoryUsage.rss > prevMemory.rss) {
							rssUsage = logger.alert(('\u2191' + rss).padStart(11));
						}
					}

					prevMemory = currentMemoryUsage;

					logger.debug(
						`CPU: ${cpuUsage}  ` +
						`Heap:${heapUsage}  ` + // purposely don't put a space after the ':', heapUsage is already left padded
						`RSS: ${rssUsage}  ` +
						`Uptime: ${logger.highlight(this.status.get(['appcd', 'uptime']).toJS().toFixed(1) + 's')}`
					);
				}, 2000);

				this.on('appcd:shutdown', () => {
					clearInterval(refreshTimer);
					clearInterval(logTimer);
					pidusage.unmonitor(process.pid);
				});

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
		return this
			.hook('appcd:init.handlers', () => {
				appcdDispatcher.register('/appcd/status/:filter*', ctx => {
					const filter = ctx.params.filter && ctx.params.filter.replace(/^\//, '').split('/') || undefined;
					const node = this.status.get(filter);
					if (!node) {
						throw new Error('Invalid request: ' + ctx.path);
					}
					ctx.conn.write(node.toJSON(true));
					if (ctx.data.continuous) {
						const off = node.watch(evt => ctx.conn.write(evt.source.toJSON(true)));
						ctx.conn.on('close', off);
						ctx.conn.on('error', off);
					} else {
						ctx.conn.close();
					}
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
		return this
			.hook('appcd:init.webserver', opts => {
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

							const source = util.mergeDeep({ type: 'websocket', name: 'Websocket client' }, req.source);

							switch (req.version) {
								case '1.0':
									const conn = new Connection({
										socket,
										id: req.id
									});

									const startTime = new Date;
									const data = req.data && typeof req.data === 'object' ? req.data : {};
									const ctx = { conn, data, source };

									// dispatch the request
									appcdDispatcher.call(req.path, ctx)
										.then(result => {
											const p = result && result instanceof Promise ? result : Promise.resolve(result);
											return p.then(result => {
												if (result || ctx.body) {
													conn.end(result || ctx.body);
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
											const status = err.status && Dispatcher.statusCodes[String(err.status)] ? err.status : ctx.status || 500;
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

				webserver.router.get('/appcd/status/:filter*', (ctx, next) => {
					const filter = ctx.params[0] && ctx.params[0].replace(/^(\/)/, '').split('/') || undefined;
					const node = this.status.get(filter);
					if (!node) {
						return next();
					}

					ctx.response.type = 'json';
					ctx.body = node.toJSON(true);
				});

				webserver.router.get('/appcd/config/:key*', this.configRouteHandler);

				this.pluginMgr.initWebRoutes(webserver.router);

				return webserver.listen();
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
		appcd.logger.info('Shutting down server gracefully');

		return Promise.resolve()
			.then(() => this.emit('analytics:event', {
				type: 'appcd.server.shutdown',
				uptime: this.status.get(['appcd', 'uptime']).toJS()
			}))
			.then(() => this.emit('appcd:shutdown'))
			.then(this.webserver.close)
			.then(this.pluginMgr.shutdown)
			.then(() => {
				const pidFile = util.expandPath(this.config('appcd.pidFile'));
				appcd.logger.info('Removing ' + appcd.logger.highlight(pidFile));
				fs.unlinkSync(pidFile);
			})
			.then(() => {
				const handles = getActiveHandles();

				if (handles.timers.length) {
					const timers = handles.timers.filter(timer => timer.__stack__);
					appcd.logger.warn(`Stopping ${appcd.logger.notice(timers.length)} active ${pluralize('timers', timers.length)}:`);
					let i = 1;
					for (const timer of timers) {
						appcd.logger.warn(`${i++}) ${appcd.logger.highlight(timer.__stack__[0] || 'unknown origin')}`);
					}
					appcd.logger.warn(`Did you forget to clear these timeouts during the ${appcd.logger.highlight('"appcd.shutdown"')} event?`);
					handles.timers.forEach(t => clearTimeout(t));
				}
			})
			.then(() => {
				appcd.logger.info('appcd shutdown successfully');
				return this;
			});
	}

	/**
	 * Full stops the server. If it doesn't exit in 10 seconds, we shoot it in
	 * the head.
	 *
	 * @param {Boolean} forceKill - Force kill the server.
	 * @returns {Promise}
	 * @access public
	 */
	stop(forceKill) {
		return new Promise((resolve, reject) => {
			const pid = this.isRunning();
			const self = this;

			if (!pid) {
				return resolve(this);
			}

			process.kill(pid, forceKill ? 'SIGKILL' : 'SIGTERM');

			const timeout = 10000;
			const interval = 500;
			let countdown = forceKill ? -1 : timeout / interval;

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
