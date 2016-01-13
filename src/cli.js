import Client from './client';
import Server from './server';
import program from 'commander';

const pkgJson = require('../package.json');

program
	.version(pkgJson.version);

program
	.command('start')
	.option('--debug', 'don\'t run as a background daemon')
	.action(cmd => {
		new Server({ daemon: !cmd.debug })
			.start()
			.catch(err => {
				console.error(err.toString());
				process.exit(1);
			});
	});

program
	.command('stop')
	.option('--force', 'force the server to stop')
	.action(cmd => {
		new Server().stop(cmd.force);
	});

program
	.command('restart')
	.option('--debug', 'don\'t run as a background daemon')
	.action(cmd => {
		new Server({ daemon: !cmd.debug })
			.stop()
			.then(server => server.start())
			.catch(err => {
				console.error(err.stack || toString());
				process.exit(1);
			});
	});

program
	.command('status')
	.option('-o, --output <report|json>', 'the format to render the output', 'report')
	.action(cmd => {
		const client = new Client();
		client
			.request('/appcd/status')
			.on('response', data => {
				console.log(data);
				client.disconnect();
			})
			.on('error', console.error);
	});

program
	.command('logcat')
	.action(() => {
		const client = new Client();
		client
			.request('/appcd/logcat')
			.on('response', console.log)
			.on('end', client.disconnect)
			.on('error', console.error);
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
