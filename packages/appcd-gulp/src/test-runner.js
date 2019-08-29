const ansiColors    = require('ansi-colors');
const fs            = require('fs');
const log           = require('fancy-log');
const path          = require('path');
const { spawnSync } = require('child_process');

const isWindows   = process.platform === 'win32';

exports.runTests = function runTests({ root, projectDir, cover, all }) {
	const args = [];
	let { execPath } = process;

	process.env.APPCD_TEST = projectDir;

	// add nyc
	if (cover) {
		const nycModuleBinDir = resolveModuleBin(root, 'nyc');
		if (isWindows) {
			execPath = path.join(nycModuleBinDir, 'nyc.cmd');
		} else {
			args.push(path.join(nycModuleBinDir, 'nyc'));
		}

		args.push(
			'--cache', 'true',
			'--exclude', 'test',
			'--exclude', 'packages/*/test/**/*.js', // exclude tests
			'--exclude', 'packages/appcd-gulp/src/**/*.js', // exclude appcd-gulp when running from the top-level of the monorepo
			'--instrument', 'true',
			'--source-map', 'true',
			// supported reporters:
			//   https://github.com/istanbuljs/istanbuljs/tree/master/packages/istanbul-reports/lib
			'--reporter=html',
			'--reporter=json',
			'--reporter=text',
			'--reporter=text-summary',
			'--reporter=cobertura',
			'--require', path.join(__dirname, 'test-transpile.js'),
			'--show-process-tree',
			process.execPath // need to specify node here so that spawn-wrap works
		);

		process.env.FORCE_COLOR = 1;
		process.env.APPCD_COVERAGE = projectDir;
	}

	// add mocha
	const mocha = resolveModule(root, 'mocha');
	if (!mocha) {
		log('Unable to find mocha!');
		process.exit(1);
	}
	args.push(path.join(mocha, 'bin', 'mocha'));

	// add --inspect
	if (process.argv.indexOf('--inspect') !== -1 || process.argv.indexOf('--inspect-brk') !== -1) {
		args.push('--inspect-brk', '--timeout', '9999999');
	}

	const jenkinsReporter = resolveModule(root, 'mocha-jenkins-reporter');
	if (jenkinsReporter) {
		args.push(`--reporter=${jenkinsReporter}`);
	}

	process.env.JUNIT_REPORT_PATH = path.join(projectDir, 'junit.xml');
	process.env.JUNIT_REPORT_NAME = path.basename(projectDir);

	// add grep
	let p = process.argv.indexOf('--grep');
	if (p !== -1 && p + 1 < process.argv.length) {
		args.push('--grep', process.argv[p + 1]);
	}

	// add transpile setup
	if (!cover) {
		args.push(path.join(__dirname, 'test-transpile.js'));
	}

	// add unit test setup
	args.push(path.join(__dirname, 'test-setup.js'));

	// add suite
	p = process.argv.indexOf('--suite');
	if (p !== -1 && p + 1 < process.argv.length) {
		const suites = process.argv[p + 1].split(',');
		args.push.apply(args, suites.map(s => `test/**/test-${s}.js`));
		if (all) {
			args.push.apply(args, suites.map(s => `packages/*/test/**/test-${s}.js`));
		}
	} else {
		args.push('test/**/test-*.js');
		if (all) {
			args.push('packages/*/test/**/test-*.js');
		}
	}

	log(`Running: ${ansiColors.cyan(`${execPath} ${args.join(' ')}`)}`);

	// run!
	try {
		if (spawnSync(execPath, args, { stdio: 'inherit' }).status) {
			const err = new Error('At least one test failed :(');
			err.showStack = false;
			throw err;
		}
	} finally {
		const after = path.join(projectDir, 'test', 'after.js');
		if (fs.existsSync(after)) {
			require(after);
		}
	}
}

function resolveModuleBin(root, name) {
	return path.resolve(resolveModule(root, name), '..', '.bin');
}

function resolveModule(root, name) {
	let dir = path.join(root, name);
	if (fs.existsSync(dir)) {
		return dir;
	}

	try {
		return path.dirname(require.resolve(name));
	} catch (e) {
		return null;
	}
};
