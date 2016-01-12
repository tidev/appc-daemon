import autobind from 'autobind-decorator';
import 'babel-polyfill';
import Connection from './connection';
import Console from './console';
import Dispatcher from './dispatcher';
import { EventEmitter } from 'events';
import fs from 'fs';
import http from 'http';
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

global.appcd = {
	Service
};

export default class Server extends EventEmitter {
	webserver = null;

	plugins = {};

	dispatcher = new Dispatcher;

	constructor(opts = {}) {
		super();

		const appcDir = path.join(process.env.HOME || process.env.USERPROFILE, '.appcelerator');
		const configFile = path.join(appcDir, 'appcd.js');
		this._cfg = fs.existsSync(configFile) && require(configFile) || {};

		this.daemon = !!opts.daemon;
		this.pidFile = path.join(appcDir, 'appcd.pid');
		this.pluginsPath = [ path.resolve(__dirname, '..', 'plugins') ].concat(this.config('paths.plugins', []));
	}

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

	start() {
		return new Promise((resolve, reject) => {
			const pid = this.isRunning();

			// if we found a pid and it's not this process, then we are not the daemon you were looking for
			if (pid && pid !== process.pid) {
				const err = new Error(`Server already running (pid: ${pid})`);
				err.code = 'ALREADY_RUNNING';
				return reject(err);
			}

			// hijack console.*
			const theConsole = this.theConsole = new Console();

			if (!pid) {
				// server is not running
				if (this.daemon) {
					this.daemonize();
					resolve(this);
					return;
				}

				// we are the server process running in debug mode, so hook up some output
				theConsole.pipe(process.stdout, true, this.config('console.colors', true));

				// since we are not running as a daemon, we have to write the pid file ourselves
				fs.writeFileSync(this.pidFile, process.pid);
			}

			// at this point, we're either running in debug mode (no pid) or *this* process is the spawned daemon process

			console.info(`Appcelerator Daemon v${pkgJson.version}`);
			console.info(`Node.js ${process.version} (module api ${process.versions.modules})`);

			// replace the process title to avoid `killall node` taking down the server
			process.title = 'appcd (Appcelerator Daemon)';

			// listen for signals to trigger a shutdown
			process.on('SIGINT', this.shutdown);
			process.on('SIGTERM', this.shutdown);

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
						if (!req.path) { throw new Error('invalid request object, missing path'); }
						if (!req.id) { throw new Error('invalid request object, missing id'); }

						switch (req.version) {
							case '1.0':
								const conn = new Connection({
									socket: ws,
									id: req.id,
									data: req.data
								});

								console.info(`REQ ${req.path}`);
								this.dispatcher.dispatch(req.path, conn)
									.then(() => {
										//
									})
									.catch(err => {
										//
									});

								break;

							default:
								throw new Error(`Unsupported version "${req.version}"`);
						}
					} catch (err) {
						console.error('Bad request:', err);
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
				.then(() => {
					// wire up the dispatcher and start listening
					this.webserver.listen();

					resolve(this);
				});
		});
	}

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

		console.info('Spawning server: ' + node + ' ' + args.map(s => typeof s === 'string' && s.indexOf(' ') !== -1 ? '"' + s + '"' : s).join(' '));

		const child = spawn(node, args, {
			detached: true,
			stdio: 'ignore'
		});
		fs.writeFileSync(this.pidFile, child.pid);
		child.unref();
	}

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
	 * Wires up the
	 */
	initHandlers() {
		this.webserver.router.get('/appcd/status', (ctx, next) => {
			ctx.response.type = 'json';
			ctx.body = JSON.stringify(this.getStatus(), null, '  ');
		});

// conn.on(path, fn)
// conn.send(it)

		this.dispatcher.register('/appcd/status', (conn) => {
			const timer = setInterval(() => {
				conn.send(this.getStatus())
					.catch(err => {
						clearInterval(timer);
					});
			}, 1000);
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
						this.webserver.router.use('/' + plugin.name.replace(/^appcd-plugin-/, ''), plugin.router.routes());
						plugin.init().then(resolve, reject);
						return;
					}
				} catch (e) {
					console.error(`Failed to load plugin ${pluginDir}`);
					console.error(e.stack || e.toString());
					console.error(`Skipping ${pluginDir}`);
				}
				resolve();
			});
		}));
	}

	@autobind
	shutdown() {
		console.info('Shutting down server gracefully');
		this.webserver.close();

		Promise.all(Object.values(this.plugins).map(plugin => {
			return plugin.shutdown();
		})).then(() => {
			console.info('Deleting ' + console.chalk.cyan(this.pidFile));
			fs.unlinkSync(this.pidFile);
			process.exit(0);
		});
	}

	stop(kill) {
		return new Promise((resolve, reject) => {
			const pid = this.isRunning();
			const self = this;

			if (!pid) {
				return resolve(this);
			}

			process.kill(pid, kill ? 'SIGKILL' : 'SIGTERM');

			let count = 0;

			function check() {
				try {
					// check 20 times (which is 5 seconds), then try to kill the server
					process.kill(pid, count === 20 ? 'SIGKILL' : 0);
					if (count > 20) {
						return reject(`Failed to kill server (pid: ${pid})`);
					}
					count++;
					setTimeout(check, 250);
				} catch (e) {
					// server shutdown successfully
					resolve(self);
				}
			}

			setTimeout(check, 250);
		});
	}

	dispatch(req, send) {
		if (req.version === '1.0') {
			// TODO: dispatch the request to the appropriate handler
			send('got it!');
		} else {
			send(`Unsupported version "${req.version}"`);
		}
	}
}
