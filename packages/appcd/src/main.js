/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import cli from './cli';

cli.exec()
	.catch(err => {
		const exitCode = err.exitCode || 1;

		if (err.json) {
			console.log(JSON.stringify({
				code: exitCode,
				result: err.toString()
			}, null, 2));
		} else {
			console.error(err.message || err);
		}

		process.exit(exitCode);
	});
