import autobind from 'autobind-decorator';
import 'babel-polyfill';
import chalk from 'chalk';
import Connection from './connection';
import Dispatcher, { DispatcherError } from './dispatcher';
import { EventEmitter } from 'events';
import fs from 'fs';
import http from 'http';
import Logger from './logger';
import os from 'os';
import path from 'path';
import Plugin from './plugin';
import Router from 'koa-router';
import Service from './service';
import { spawn } from 'child_process';
import stream from 'stream';
import WebServer from './webserver';
import 'source-map-support/register';

const pkgJson = require('../package.json');

/**
 * Global appcd namespace.
 */
global.appcd = {
	logger: new Logger('appcd'),
	Service
};

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
	 * The request dipatcher.
	 * @type {Dispatcher}
	 */
	dispatcher = new Dispatcher;

	/**
	 * Constructs a server instance.
	 *
	 * @param {Object} [opts]
	 * @param {Boolean} [opts.daemon=false]
	 * @param {Object} [opts.logger]
	 * @param {Boolean} [opts.logger.color=true]
	 * @param {Boolean} [opts.logger.silent=false]
	 */
	constructor(opts = {}) {
		super();

		const appcDir = path.join(process.env.HOME || process.env.USERPROFILE, '.appcelerator');
		const configFile = path.join(appcDir, 'appcd.js');

		const cfg = this._cfg = fs.existsSync(configFile) && require(configFile) || {};

		cfg.logger || (cfg.logger = {});
		Object.assign(cfg.logger, opts.logger);

		this.daemon = !!opts.daemon;
		this.pidFile = path.join(appcDir, 'appcd.pid');
		this.pluginsPath = [ path.resolve(__dirname, '..', 'plugins') ].concat(this.config('paths.plugins', []));
	}

	/**
	 * Returns a configuration setting.
	 *
	 * @param {String} key
	 * @param {*} [defaultValue]
	 * @returns {*}
	 * @access public
	 */
	config(key, defaultValue) {
		const parts = key.split('.');
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
					Logger.pipe(process.stdout, true, this.config('logger.colors', true));
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

			this.webserver.on('websocket', ws => {
				ws.on('message', message => {
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
									socket: ws,
									id: req.id,
									data: req.data || {}
								});


/*

errors

1. unsupported version

2. bad request

3. dispatch bad URL

4. dispatch handler threw error

5. dispatch handler rejected

6. websocket closed and handler tried to send()

*/

								const startTime = new Date;

								this.dispatcher.dispatch(req.path, conn)
									.then((res) => {
										appcd.logger.info(chalk.blue('REQ ' + req.path) + ' ' + chalk.green(res.status) + ' ' + chalk.cyan(new Date - startTime) + 'ms');
									})
									.catch(err => {
										if (err instanceof DispatcherError) {
											ws.send(err.toJSON());
										} else {
											appcd.logger.error(chalk.red('REQ ' + req.path + ' 500 ' + (new Date - startTime) + 'ms'));
											appcd.logger.error(err.stack || err.toString());
											ws.send(JSON.stringify({
												status: 500,
												error: Dispatcher.statusCodes['500'] + ': ' + err.toString()
											}));
										}
									});

								break;

							default:
								throw new Error(`Unsupported version "${req.version}"`);
						}
					} catch (err) {
						appcd.logger.error('Bad request:', err);
						ws.send(JSON.stringify({
							status: 400,
							error: 'Bad request: ' + err.toString()
						}));
					}
				});

				ws.on('close', () => {
					// client hung up
				});
			});


			/*
				let done = false;

console.info(req);
					if (req && typeof req === 'object' && req.version === '1.0' && req.path && req.id) {
						if (!req.data || typeof req.data !== 'object') {
							req.data = {};
						}

						// get the handler from the dispatcher
						const handler = this.dispatcher.getHandler();

						// const ctx = {
						// 	method: 'GET',
						// 	path: req.path,
						// 	response: {}
						// };

						// route(ctx).then(() => {
						// 	console.info('finished routing ' + req.path);
						// 	console.log(ctx);
						// 	ws.send(JSON.stringify({
						// 		id: req.id,
						//      status: 200,
						// 		data: JSON.parse(ctx.body)
						// 	}));
						// }).catch(err => {
						// 	console.error('error routing ' + req.path);
						// 	console.error(err);
						// });

						// this.emit('dispatch', req, (payload) => {
						// 	if (!done) {
						// 		done = true;
						// 		ws.send(JSON.stringify({
						// 			id: req.id,
						// 			data: payload
						// 		}));
						// 	}
						// });
					}
				} catch (e) {
					console.error('Failed to parse request:', e);
				}

				ws.on('close', () => {
					// client hung up
					done = true;
				});
			});
		});
*/


/*
router.get('/logcat', (ctx, next) => {
	const s = new stream.Writable;
	const end = this.theConsole.stream(s, s, false);
	let buffer = '';

	s.on('data', data => {
		ctx.body = data;
	});

	s.on('error', err => {
		end();
		console.error(err);
	});
});


if the websocket is closed, we need to let logcat() know to stop!


thinger.on('/logcat', (ctx) => {
	const s = new stream.Writable;
	const end = this.theConsole.stream(s, s, false);
	try {
		s.pipe(ctx);
	} catch (e) {
		end();
	}
});
*/


		// this.server.on('connection', ws => {
		// 	var id = setInterval(function() {
		// 		ws.send(JSON.stringify(process.memoryUsage()), function() { /* ignore errors */ });
		// 	}, 500);
		//
		// 	ws.on('message', function incoming(message) {
		// 	    console.log('received: %s', message);
		// 	  });
		//
		// 	console.log('started client interval');
		//
		// 	ws.on('close', function() {
		// 		console.log('stopping client interval');
		// 		clearInterval(id);
		// 	});
		// });

			this.initHandlers();

			Promise.resolve()
				.then(this.loadPlugins)
				.then(this.webserver.listen)
				.then(resolve)
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

		appcd.logger.info('Spawning server: ' + node + ' ' + args.map(s => typeof s === 'string' && s.indexOf(' ') !== -1 ? '"' + s + '"' : s).join(' '));

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
	 * @access private
	 */
	getStatus() {
		return {
			appcd: {
				version:  pkgJson.version,
				uptime:   process.uptime(),
				pid:      process.pid,
				execPath: process.execPath,
				execArgv: process.execArgv,
				argv:     process.argv,
				env:      process.env,
				plugins:  Object.keys(this.plugins)
			},
			node: {
				version:  process.version.replace(/^v/, ''),
				versions: process.versions
			},
			system: {
				platform: process.platform,
				arch:     process.arch,
				cpus:     os.cpus().length,
				hostname: os.hostname(),
				loadavg:  os.loadavg(),
				memory: {
					usage: process.memoryUsage(),
					free:  os.freemem(),
					total: os.totalmem()
				}
			}
		};
	}

	/**
	 * Wires up core request handlers.
	 *
	 * @access private
	 */
	initHandlers() {
		this.webserver.router.get('/appcd/status', (ctx, next) => {
			ctx.response.type = 'json';
			ctx.body = JSON.stringify(this.getStatus(), null, '  ');
		});

// conn.on(path, fn)
// conn.send(it)

		this.dispatcher.register('/appcd/status', conn => {
			const timer = setInterval(() => {
				conn.send(this.getStatus())
					.catch(err => {
						clearInterval(timer);
					});
			}, 1000);
		});

		this.dispatcher.register('/appcd/logcat', conn => {
			Logger.pipe(conn);
		});

		// router.get('/logcat', (ctx, next) => {
		// 	this.theConsole.pipe(ctx);
		// 	const s = new stream.Writable;
		// 	this.theConsole.stream(s, s, false);
		//
		// 	s.on('data', data => {
		// 		//
		// 	});
		//
		// 	s.on('close', () => {
		// 		//
		// 	});
		//
		// 	s.on('error', err => {
		// 		//
		// 	});
		// });
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
		const pluginDirs = [];
		this.pluginsPath.forEach(dir => {
			fs.readdirSync(dir).forEach((name) => {
				const pluginDir = path.join(dir, name);
				if (fs.existsSync(pluginDir) && fs.statSync(pluginDir).isDirectory()) {
					pluginDirs.push(pluginDir);
				}
			});
		});

		return Promise.all(pluginDirs.map(pluginDir => {
			return new Promise((resolve, reject) => {
				try {
					const plugin = Plugin.load(pluginDir);
					if (plugin) {
						this.plugins[plugin.name] = plugin;
						plugin.init()
							.then(() => {
								// plugin initialized successfully, so wire up any routes
								this.webserver.router.use('/' + plugin.name.replace(/^appcd-plugin-/, ''), plugin.router.routes());
								resolve();
							})
							.catch(reject);
						return;
					}
				} catch (e) {
					appcd.logger.error(`Failed to load plugin ${pluginDir}`);
					appcd.logger.error(e.stack || e.toString());
					appcd.logger.error(`Skipping ${pluginDir}`);
				}
				resolve();
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
			this.webserver.close();

			Promise.all(Object.values(this.plugins).map(plugin => { return plugin.shutdown(); }))
				.then(() => {
					appcd.logger.info('Removing ' + chalk.cyan(this.pidFile));
					fs.unlinkSync(this.pidFile);

					resolve();
				})
				.catch(reject);
		});
	}

	/**
	 * Full stops the server. If it doesn't exit in 35 seconds, we shoot it in
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

			const timeout = 35000;
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
