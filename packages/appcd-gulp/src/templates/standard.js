'use strict';

module.exports = (opts) => {
	const {
		exports,
		projectDir
	} = opts;

	if (!exports) {
		throw new Error('Missing required "exports" option');
	}

	const $           = require('gulp-load-plugins')();
	const ansiColors  = require('ansi-colors');
	const babelConf   = require('../babel')(opts);
	const fs          = require('fs-extra');
	const gulp        = require('gulp');
	const log         = require('fancy-log');
	const Module      = require('module');
	const path        = require('path');
	const spawnSync   = require('child_process').spawnSync;

	const coverageDir = path.join(projectDir, 'coverage');
	const distDir     = path.join(projectDir, 'dist');
	const docsDir     = path.join(projectDir, 'docs');

	const isWindows   = process.platform === 'win32';

	const { parallel, series } = gulp;

	/*
	 * Inject appcd-gulp into require() search path
	 */
	const appcdGulpNodeModulesPath = path.resolve(__dirname, '../../node_modules');
	const origNodeModulesPaths = Module._nodeModulePaths;
	Module._nodeModulePaths = function (from) {
		return origNodeModulesPaths.call(this, from).concat(appcdGulpNodeModulesPath);
	};

	/*
	 * Clean tasks
	 */
	async function cleanCoverage() { return fs.remove(coverageDir); }
	async function cleanDist() { return fs.remove(distDir); }
	async function cleanDocs() { return fs.remove(docsDir); }
	exports.clean = parallel(cleanCoverage, cleanDist, cleanDocs);

	/*
	 * lint tasks
	 */
	function lint(pattern, eslintFile = 'eslint.json') {
		const baseConfig = require(path.resolve(__dirname, '..', eslintFile));

		// check if the user has a custom .eslintrc in the root of the project
		let custom = path.join(opts.projectDir, '.eslintrc');
		if (fs.existsSync(custom)) {
			(function merge(dest, src) {
				for (const key of Object.keys(src)) {
					if (src[key] && typeof src[key] === 'object' && !Array.isArray(src[key])) {
						if (!dest[key] || typeof dest[key] !== 'object' || Array.isArray(dest[key])) {
							dest[key] = {};
						}
						merge(dest[key], src[key]);
					} else {
						dest[key] = src[key];
					}
				}
			}(baseConfig, JSON.parse(fs.readFileSync(custom))));
		}

		return gulp.src(pattern)
			.pipe($.eslint({ baseConfig }))
			.pipe($.eslint.format())
			.pipe($.eslint.failAfterError());
	}
	async function lintSrc() { return lint('src/**/*.js'); }
	async function lintTest() { return lint('test/**/test-*.js', 'eslint-tests.json'); }
	exports['lint-src'] = lintSrc;
	exports['lint-test'] = lintTest;
	exports.lint = parallel(lintSrc, lintTest);

	/*
	 * build tasks
	 */
	const build = series(parallel(cleanDist, lintSrc), function build() {
		return gulp.src('src/**/*.js')
			.pipe($.plumber())
			.pipe($.debug({ title: 'build' }))
			.pipe($.sourcemaps.init())
			.pipe($.babel({
				cwd:        __dirname,
				plugins:    babelConf.plugins,
				presets:    babelConf.presets,
				sourceRoot: 'src'
			}))
			.pipe($.sourcemaps.write())
			.pipe(gulp.dest(distDir));
	});
	exports.build = build;
	exports.default = build;

	exports.docs = series(parallel(cleanDocs, lintSrc), async () => {
		const esdoc = require('esdoc').default;

		esdoc.generate({
			// debug: true,
			destination: docsDir,
			plugins: [
				{
					name: 'esdoc-standard-plugin',
					option: {
						brand: {
							title:       opts.pkgJson.name,
							description: opts.pkgJson.description,
							respository: 'https://github.com/appcelerator/appc-daemon',
							site:        'https://github.com/appcelerator/appc-daemon'
						}
					}
				},
				{
					name: 'esdoc-ecmascript-proposal-plugin',
					option: {
						all: true
					}
				}
			],
			source: './src'
		});
	});

	/*
	 * test tasks
	 */
	async function runTests(cover) {
		const args = [];
		let { execPath } = process;

		// add nyc
		if (cover) {
			const nycModuleBinDir = resolveModuleBin('nyc');
			if (isWindows) {
				execPath = path.join(nycModuleBinDir, 'nyc.cmd');
			} else {
				args.push(path.join(nycModuleBinDir, 'nyc'));
			}

			args.push(
				'--cache', 'false',
				'--exclude', 'test',
				'--instrument', 'false',
				'--source-map', 'false',
				// supported reporters:
				//   https://github.com/istanbuljs/istanbuljs/tree/master/packages/istanbul-reports/lib
				'--reporter=html',
				'--reporter=json',
				'--reporter=text',
				'--reporter=text-summary',
				'--require', path.resolve(__dirname, '../test-transpile.js'),
				'--show-process-tree',
				process.execPath // need to specify node here so that spawn-wrap works
			);

			process.env.FORCE_COLOR = 1;
			process.env.APPCD_COVERAGE = projectDir;
		}

		// add mocha
		const mocha = resolveModule('mocha');
		if (!mocha) {
			log('Unable to find mocha!');
			process.exit(1);
		}
		args.push(path.join(mocha, 'bin', 'mocha'));

		// add --inspect
		if (process.argv.indexOf('--inspect') !== -1 || process.argv.indexOf('--inspect-brk') !== -1) {
			args.push('--inspect-brk');
		}

		const jenkinsReporter = resolveModule('mocha-jenkins-reporter');
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
			args.push(path.resolve(__dirname, '../test-transpile.js'));
		}

		// add unit test setup
		args.push(path.resolve(__dirname, '../test-setup.js'));

		// add suite
		p = process.argv.indexOf('--suite');
		if (p !== -1 && p + 1 < process.argv.length) {
			args.push.apply(args, process.argv[p + 1].split(',').map(s => 'test/**/test-' + s + '.js'));
		} else {
			args.push('test/**/test-*.js');
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

	function resolveModuleBin(name) {
		return path.resolve(resolveModule(name), '..', '.bin');
	}

	function resolveModule(name) {
		let dir = path.join(appcdGulpNodeModulesPath, name);
		if (fs.existsSync(dir)) {
			return dir;
		}

		try {
			return path.dirname(require.resolve(name));
		} catch (e) {
			return null;
		}
	}

	exports.test             = series(parallel(lintTest, build),                function test() { return runTests(); });
	exports['test-only']     = series(lintTest,                                 function test() { return runTests(); });
	exports.coverage         = series(parallel(cleanCoverage, lintTest, build), function test() { return runTests(true); });
	exports['coverage-only'] = series(parallel(cleanCoverage, lintTest),        function test() { return runTests(true); });

	/*
	 * watch tasks
	 */
	exports.watch = async function watch() {
		gulp.watch(`${process.cwd()}/src/**/*.js`)
			.on('all', async (type, path) => {
				await build();
				console.log(`File ${path} was ${type}, running tasks...`);
			});
	};

	exports['watch-test'] = async function watchTest() {
		gulp.watch([ `${process.cwd()}/src/**/*.js`, `${process.cwd()}/test/*.js` ])
			.on('all', async (type, path) => {
				await test();
				console.log(`File ${path} was ${type}, running tasks...`);
			});
	};
};
