import { EventEmitter } from 'events';
import Console from './console';
import Dispatcher from './dispatcher';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import WebServer from './webserver';

const pkgJson = require('../package.json');

export default class Server extends EventEmitter {
	constructor(opts = {}) {
		super();

		const appcDir = path.join(process.env.HOME || process.env.USERPROFILE, '.appcelerator');
		const configFile = path.join(appcDir, 'appcd.js');

		const cfg = {};
		if (fs.existsSync(configFile)) {
			(function add(obj, prefix) {
				Object.keys(obj).forEach(key => {
					if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
						add(obj[key], prefix + key + '.');
					} else {
						cfg[prefix + key] = obj[key];
					}
				});
			}(require(configFile) || {}, ''));
		}
		this.config = (key, defaultValue) => {
			const value = cfg[key];
			return value !== undefined ? value : defaultValue;
		};

		this.daemonize = opts.daemonize;

		this.pidFile = path.join(appcDir, 'appcd.pid');

		this.webserver = new WebServer({
			hostname: this.config('hostname', '127.0.0.1'),
			port:     this.config('port', 1732)
		});
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
			const theConsole = new Console();

			if (!pid) {
				// server is not running

				if (this.daemonize) {
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

					return resolve(this);
				}

				// we are the server process running in debug mode, so hook up some output
				theConsole.stream(process.stdout, process.stderr, this.config('console.colors', true));

				// since we are not running as a daemon, we have to write the pid file ourselves
				fs.writeFileSync(this.pidFile, process.pid);
			}

			// at this point, we're either running in debug mode (no pid) or *this* process is the spawned daemon process

			console.info(`Appcelerator Daemon v${pkgJson.version}`);
			console.info(`Node.js ${process.version} (module api ${process.versions.modules})`);

			// replace the process title to avoid `killall node` taking down the server
			process.title = 'appcd (Appcelerator Daemon)';

			// listen for signals to trigger a shutdown
			process.on('SIGINT', this.shutdown.bind(this));
			process.on('SIGTERM', this.shutdown.bind(this));

			// wire up the dispatcher and start listening
			this.webserver
				.on('dispatch', this.dispatch.bind(this))
				.listen();

			resolve(this);
		});
	}

	shutdown() {
		this.webserver.close();
		fs.unlinkSync(this.pidFile);
		process.exit(0);
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
