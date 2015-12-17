import Client from './client';
import program from 'commander';
import Server from './server';

const pkgJson = require('../package.json');

program
	.version(pkgJson.version);

program
	.command('start')
	.option('--debug', 'don\'t run as a background daemon')
	.action(cmd => {
		new Server({ daemonize: !cmd.debug })
			.start()
			.catch(err => {
				console.error(err.toString());
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
		new Server({ daemonize: !cmd.debug })
			.stop()
			.then(server => {
				return server.start();
			})
			.catch(err => {
				console.error(err.toString());
			});
	});

program
	.command('status')
	.option('-o, --output <report|json>', 'the format to render the output', 'report')
	.action(cmd => {
		new Client()
			.request('status')
			.on('response', data => {
				console.log('got status!');
				console.log(data);
			});
	});

program
	.command('logcat')
	.action(() => {
		new Client()
			.request('logcat')
			.then((connection) => {
				console.log('got status!');
			})
			.catch(err => {
				console.error(err.toString());
			});
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
