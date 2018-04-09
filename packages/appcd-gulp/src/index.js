'use strict';

/**
 * Loads a pre-defined set of gulp tasks (i.e. template).
 *
 * @param {Object} opts - Various options
 * @param {String} [opts.projectDir] - The path to the project directory. If not
 * specified, then it will recursively scan parent modules until it finds the
 * `gulpfile.js` that `require()`'d `appcd-gulp`.
 * @param {String} [opts.template] - The name of the template to use.
 */
module.exports = opts => {
	const ansiColors  = require('ansi-colors');
	const fs = require('fs');
	const log = require('fancy-log');
	const path = require('path');

	let parent = module.parent;
	if (!opts.projectDir) {
		while (parent) {
			if (/[\/\\]gulpfile(\.tmp\.\d+)?\.js$/.test(parent.filename)) {
				opts.projectDir = path.dirname(parent.filename);
				break;
			}
			parent = parent.parent;
		}
	}

	if (!opts.projectDir) {
		log(ansiColors.red('You MUST call appcd-gulp from a gulpfile.js'));
		process.exit(1);
	}

	if (!opts.template) {
		log(ansiColors.red('You MUST specify a template'));
		process.exit(1);
	}

	const file = path.join(__dirname, 'templates', `${opts.template}.js`);
	try {
		if (opts.template === 'index' || !fs.statSync(file).isFile()) {
			throw new Error();
		}
	} catch (e) {
		log(ansiColors.red(opts.template ? `Unknown template: ${opts.template}` : 'Invalid template'));
		process.exit(1);
	}

	require(file)(opts);
};
