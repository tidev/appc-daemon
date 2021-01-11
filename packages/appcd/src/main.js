/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import cli from './cli';
import appcdLogger from 'appcd-logger';

(async () => {
	const { alert } = appcdLogger.styles;

	let checkWait;

	cli.on('banner', ({ argv }) => {
		const { check } = require('check-kit');
		const { expandPath } = require('appcd-path');
		const { loadConfig } = require('./common');
		const { resolve } = require('path');
		const cfg = loadConfig(argv);
		const network = cfg.get('network') || {};

		// store the check promise and let it continue asynchronously
		checkWait = check({
			caFile:    network?.caFile,
			certFile:  network?.certFile,
			keyFile:   network?.keyFile,
			metaDir:   expandPath(cfg.get('home'), 'update'),
			pkg:       resolve(__dirname, '..', 'package.json'),
			proxy:     network?.proxy,
			strictSSL: network?.strictSSL
		}).catch(() => {});
	});

	try {
		const { console } = await cli.exec();

		// now that the command is done, wait for the check to finish and display it's message,
		// if there is one
		if (checkWait) {
			const {
				current,
				latest,
				name,
				updateAvailable
			} = await checkWait;

			if (updateAvailable) {
				const boxen = require('boxen');
				const { cyan, gray, green } = require('appcd-logger').snooplogg.chalk;
				const msg = `Update available ${gray(current)} → ${green(latest)}\nRun ${cyan(`npm i -g ${name}`)} to update`;
				console.log(`\n${boxen(msg, {
					align: 'center',
					borderColor: 'yellow',
					borderStyle: 'round',
					margin: { bottom: 1, left: 4, right: 4, top: 1 },
					padding: { bottom: 1, left: 4, right: 4, top: 1 }
				})}`);
			}
		}
	} catch (err) {
		const exitCode = err.exitCode || 1;

		if (err.json) {
			console.log(JSON.stringify({
				code: exitCode,
				result: err.toString()
			}, null, 2));
		} else {
			console.error(alert(`${process.platform === 'win32' ? 'x' : '✖'} ${err}`));
		}

		process.exit(exitCode);
	}
})();
