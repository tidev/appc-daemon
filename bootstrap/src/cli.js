import appc from 'node-appc';
import Client from 'appcd-client';
import { detectCores, findCore, loadCore, switchCore } from './index';
import program from 'commander';

const pkgJson = require('../package.json');
const userAgent = `appcd/${pkgJson.version} node/${process.version.replace(/^v/, '')} ${process.platform} ${process.arch}`;

program
	.command('start')
	.option('--config <json>', 'serialized JSON string to mix into the appcd config')
	.option('--config-file <file>', 'path to a appcd JS config file')
	.option('--debug', 'don\'t run as a background daemon')
	.action(cmd => {
		Promise.resolve()
			.then(() => loadCore({ version: program.use }))
			.then(appcd => createServer(appcd, cmd, {
				appcd: {
					allowExit: false,
					daemonize: !cmd.debug
				}
			}))
			.then(server => server.start())
			.catch(handleError);
	});

program
	.command('stop')
	.option('--config <json>', 'serialized JSON string to mix into the appcd config')
	.option('--config-file <file>', 'path to a appcd JS config file')
	.option('--force', 'force the server to stop')
	.action(cmd => {
		Promise.resolve()
			.then(() => loadCore({ version: program.use }))
			.then(appcd => createServer(appcd, cmd))
			.then(server => server.stop(cmd.force))
			.catch(handleError);
	});

program
	.command('restart')
	.option('--config <json>', 'serialized JSON string to mix into the appcd config')
	.option('--config-file <file>', 'path to a appcd JS config file')
	.option('--debug', 'don\'t run as a background daemon')
	.action(cmd => {
		Promise.resolve()
			.then(() => loadCore({ version: program.use }))
			.then(appcd => createServer(appcd, cmd, {
				appcd: {
					allowExit: false,
					daemonize: !cmd.debug
				}
			}))
			.then(server => server.stop())
			.then(server => (console.log('-- restart --'), server))
			.then(server => server.start())
			.catch(handleError);
	});

program
	.command('exec <path> [<json>]')
	.action((path, json) => {
		let payload = {};
		if (json) {
			try {
				payload = JSON.parse(json);
			} catch (e) {
				console.error('Error parsing JSON:');
				console.error(e);
				process.exit(1);
			}
		}

		createRequest(path, payload)
			.request
			.on('response', data => {
				console.log(data);
			});
	});

program
	.command('logcat')
	.option('--no-colors', 'disables colors')
	.action(cmd => {
		createRequest('/appcd/logcat', { colors: cmd.colors })
			.request
			.on('response', data => {
				process.stdout.write(data);
			});
	});

program
	.command('status')
	.option('--json', 'outputs the status as JSON')
	.action(cmd => {
		const { client, request } = createRequest('/appcd/status');
		request.on('response', data => {
			client.disconnect();
			if (cmd.json) {
				console.info(data);
			} else {
				const { appcd, node, system } = JSON.parse(data);
				console.info(`Version:      ${appcd.version}`);
				console.info(`PID:          ${appcd.pid}`);
				console.info(`Uptime:       ${(appcd.uptime / 60).toFixed(2)} minutes`);
				console.info(`Node.js:      ${node.version}`);
				console.info(`Memory RSS:   ${system.memory.usage.rss}`);
				console.info(`Memory Heap:  ${system.memory.usage.heapUsed} / ${system.memory.usage.heapTotal}`);
			}
		});
	});

program
	.command('switch [<version>]')
	.option('--json', 'outputs the status as JSON')
	.action((version, cmd) => {
		if (version) {
			switchCore({ version })
				.catch(handleError);
			return;
		}

		const cores = detectCores();
		if (cmd.json) {
			console.info(JSON.stringify(cores, null, '    '));
		} else {
			const versions = Object.keys(cores);
			if (versions.length) {
				console.info('Available cores:');
				for (const ver of versions) {
					console.info('  ' + ver + '\t' + cores[ver].path);
				}
			} else {
				console.info('No cores found');
			}
		}
		process.exit(1);
	});

program
	.command('*')
	.action(cmd => {
		console.error(`Invalid command "${cmd}"`);
		program.help();
	});

program
	.option('-v, --version', 'outputs the version info')
	.option('--use <version>', 'selects the appcd core to use')
	.removeAllListeners('version')
	.on('version', () => {
		const versions = {
			bootstrap: pkgJson.version,
			core: null
		};

		try {
			const core = findCore({ version: program.use });
			versions.core = core.pkgJson.version;
		} catch (e) {
			// squeltch
		}

		console.info(JSON.stringify(versions, null, '  '));
		process.exit(0);
	})
	.parse(process.argv);

if (program.args.length === 0) {
	program.help();
}

/**
 * Displays an error from a promise chain, then exits.
 *
 * @param {Error} err - The error.
 */
function handleError(err) {
	if (err.code === 'ECONNREFUSED') {
		console.error('Server not running');
	} else {
		console.error(err.stack || err.toString());
	}
	process.exit(1);
}

/**
 * Parses and mixes a JSON serialized into the specified object.
 *
 * @param {Object} obj={} - The object to mix the config into.
 * @param {String} config - A JSON serialized string.
 * @returns {Object}
 */
function mixinConfig(obj = {}, config) {
	if (config) {
		let json = null;
		try {
			json = eval('(' + config + ')');
		} catch (e) {
			throw new Error('Failed to parse JSON config: ' + e.toString());
		}
		if (!json || typeof json !== 'object') {
			throw new Error('Invalid config: must be an object');
		}
		appc.util.mergeDeep(obj, json);
	}
	return obj;
}

/**
 * Creates an server instance with the config.
 *
 * @param {Object} appcd - The Appc Daemon core object.
 * @param {Object} cmd - The commander command instance.
 * @param {Object} [config] - An optional config to mix into the default config.
 * @returns {Server}
 */
function createServer(appcd, cmd, config) {
	return new appcd.Server(appc.util.mergeDeep(mixinConfig({
		analytics: {
			userAgent
		},
		appcd: {
			configFile: cmd.configFile
		}
	}, cmd.config), config || {}));
}

/**
 * Makes a request to the Appc Daemon.
 *
 * @param {String} path - The path to request.
 * @param {Object} [payload] - The data to send along with the request.
 * @returns {Client}
 */
function createRequest(path, payload) {
	const client = new Client({ userAgent });
	const request = client
		.request(path, payload)
		.on('close', () => process.exit(0))
		.on('error', err => {
			if (err.code === 'ECONNREFUSED') {
				console.error('Server not running');
			} else {
				client.disconnect();
				console.error(err.toString());
			}
			process.exit(1);
		});

	function disconnect() {
		client.disconnect();
		process.exit(0);
	}

	process.on('SIGINT', disconnect);
	process.on('SIGTERM', disconnect);

	return { client, request };
}
