import Client from './client';
import Server from './server';
import program from 'commander';

const pkgJson = require('../package.json');

program
	.version(pkgJson.version);

program
	.command('start')
	.option('--config <json>', 'serialized JSON string to mix into the appcd config')
	.option('--config-file <file>', 'path to a appcd JS config file')
	.option('--debug', 'don\'t run as a background daemon')
	.action(cmd => {
		try {
			new Server(mixinConfig({
				configFile: cmd.configFile,
				daemon: !cmd.debug
			}, cmd.config))
				.start()
				.catch(err => {
					console.error(err.toString());
					process.exit(1);
				});
		} catch (e) {
			console.error(e.toString());
			process.exit(1);
		}
	});

program
	.command('stop')
	.option('--force', 'force the server to stop')
	.action(cmd => {
		new Server()
			.stop(cmd.force);
	});

program
	.command('restart')
	.option('--config <json>', 'serialized JSON string to mix into the appcd config')
	.option('--config-file <file>', 'path to a appcd JS config file')
	.option('--debug', 'don\'t run as a background daemon')
	.action(cmd => {
		new Server(mixinConfig({
			configFile: cmd.configFile,
			daemon: !cmd.debug
		}, cmd.config))
			.stop()
			.then(server => server.start())
			.catch(err => {
				console.error(err.stack || toString());
				process.exit(1);
			});
	});

function handleError(err) {
	if (err.code === 'ECONNREFUSED') {
		console.error('Server not running');
	} else {
		console.error(err.message || err.toString());
	}
	process.exit(1);
}

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

		const client = new Client({ startServer: false });
		client
			.request(path, payload)
			.on('response', data => {
				console.log(data);
			})
			.on('close', () => process.exit(0))
			.on('error', err => {
				client.disconnect();
				handleError(err);
			});

		function disconnect() {
			client.disconnect();
			process.exit(0);
		}

		process.on('SIGINT', disconnect);
		process.on('SIGTERM', disconnect);
	});

program
	.command('logcat')
	.option('--no-colors', 'disables colors')
	.action(cmd => {
		const client = new Client({ startServer: false });
		client
			.request('/appcd/logcat', { colors: cmd.colors })
			.on('response', data => {
				process.stdout.write(data);
			})
			.on('end', client.disconnect)
			.on('error', handleError);
	});

program
	.command('status')
	.option('-o, --output <report|json>', 'the format to render the output', 'report')
	.action(cmd => {
		const client = new Client({ startServer: false });
		client
			.request('/appcd/status')
			.on('response', data => {
				console.log(data);
				client.disconnect();
			})
			.on('error', handleError);
	});

program
	.command('*')
	.action(cmd => {
		console.error(`Invalid command "${cmd}"`);
		program.help();
	});

program.parse(process.argv);

if (program.args.length === 0) {
	program.help();
}

function mixinConfig(opts, config) {
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
		Object.assign(opts, json);
	}
	return opts;
}
