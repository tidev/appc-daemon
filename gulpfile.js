'use strict';

const ansiColors   = require('ansi-colors');
const chug         = require('gulp-chug');
const debug        = require('gulp-debug');
const fs           = require('fs-extra');
const globule      = require('globule');
const gulp         = require('gulp');
const libnpm       = require('libnpm');
let log            = require('fancy-log');
const path         = require('path');
const plumber      = require('gulp-plumber');
const promiseLimit = require('promise-limit');
const semver       = require('semver');
const spawn        = require('child_process').spawn;
const spawnSync    = require('child_process').spawnSync;
const Table        = require('cli-table3');
const tmp          = require('tmp');
const toposort     = require('toposort');
// const util         = require('util');

const isWindows = process.platform === 'win32';

const { series } = gulp;
const { red, yellow, green, cyan, magenta, gray } = ansiColors;

const cliTableChars = {
	bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
	left: '', 'left-mid': '',
	mid: '', 'mid-mid': '', middle: '',
	right: '', 'right-mid': '',
	top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
};

/*
 * The following is a list of npm packages that should NOT be upgraded when running `gulp check` or
 * `gulp upgrade`.
 */
const dontUpdate = [
];

const appcdRE = /^appcd-/;
const appcdPackages = new Set(fs.readdirSync(path.join(__dirname, 'packages')).filter(name => appcdRE.test(name)));

process.env.FORCE_COLOR = 1;

if (process.argv.indexOf('--silent') !== -1) {
	// this is exactly what gulp does internally
	log = function () {};
}

const nodeInfo = exports['node-info'] = async function nodeInfo() {
	log(`Node.js ${process.version} (${process.platform})`);
	log(process.env);
}

/*
 * misc tasks
 */
exports.check = async function check() {
	if (process.argv.indexOf('--json') !== -1 && process.argv.indexOf('--silent') === -1) {
		console.error(red('Please rerun using the --silent option'));
		process.exit(1);
	}

	const results = await checkPackages();
	if (process.argv.indexOf('--json') !== -1) {
		console.log(JSON.stringify(results, null, 2));
	} else {
		renderPackages(results);
	}
};

// checks to see if an appcd package requires a node version that is less than a dependencies node requirement
exports['check-engines'] = async function checkEngines() {
	const cache = {};
	const issues = [];

	const checkPackage = (pkgPath, depth = 0) => {
		const pkgJsonPath = path.join(pkgPath, 'package.json');
		if (!fs.existsSync(pkgJsonPath)) {
			return false;
		}

		if (cache[pkgPath]) {
			return cache[pkgPath];
		}

		const pkgJson = require(pkgJsonPath);
		const info = pkgJson.engines && pkgJson.engines.node && semver.coerce(pkgJson.engines.node);
		const node = cache[pkgPath] = info ? info.version : null;

		// console.log(`${'  '.repeat(depth)}${green(pkgJson.name)}${node ? ` (${node})` : ''}`);

		if (pkgJson.dependencies) {
			for (const dep of Object.keys(pkgJson.dependencies)) {
				for (let wd = pkgPath; true; wd = path.dirname(wd)) {
					const depNode = checkPackage(path.join(wd, 'node_modules', dep), depth + 1);
					if (!cache[pkgPath] || (depNode && semver.gt(depNode, cache[pkgPath]))) {
						cache[pkgPath] = depNode;
					}
					if (appcdRE.test(pkgJson.name) && node && depNode && semver.lt(node, depNode)) {
						issues.push({
							name: pkgJson.name,
							node,
							dep,
							depNode
						});
						break;
					}
					if (depNode !== false) {
						// depNode is null (no node version) or a string
						break;
					}
					if (wd === __dirname) {
						throw new Error(`Unable to find dependency "${dep}"`);
					}
				}
			}
		}

		return cache[pkgPath];
	};

	const nodeVer = checkPackage(`${__dirname}/packages/appcd`);
	console.log(`\nMinimum Node version should be ${cyan(nodeVer)}\n`);

	if (issues.length) {
		console.log(`Found ${issues.length} issue${issues.length === 1 ? '' : 's'}`);
		console.log(issues.map(({ name, node, dep, depNode }) => `  ${green(name)} requires ${node}\n    ${cyan(dep)} requires ${depNode}`).join('\n') + '\n');
	}
};

function getFilesToNuke() {
	const nuke = [];

	(function walk(dir) {
		for (const name of fs.readdirSync(dir)) {
			const file = path.join(dir, name);
			if (fs.statSync(file).isDirectory()) {
				switch (name) {
					case 'docs':
						if (dir === __dirname) {
							break;
						}
					case 'node_modules':
						if (dir.includes(`test${path.sep}fixtures`) || dir === __dirname) {
							break;
						}
					case '.nyc_output':
					case 'coverage':
					case 'dist':
						nuke.push(file);
						break;
					default:
						walk(file);
				}
			} else {
				switch (name) {
					case '.DS_Store':
					case 'junit.xml':
					case 'lerna-debug.log':
					case 'npm-debug.log':
					case 'retire_output.json':
					case 'yarn-error.log':
						nuke.push(file);
						break;
					case 'yarn.lock':
						if (dir.includes('packages/appcd')) {
							nuke.push(file);
						}
						break;
					default:
						if (name.startsWith('gulpfile.tmp.') || name.startsWith('._')) {
							nuke.push(file);
						}
				}
			}
		}
	}(__dirname));

	nuke.push(path.join(__dirname, 'node_modules'));

	return nuke;
}

exports.clean = async function clean() {
	const nuke = getFilesToNuke();
	const s = nuke.length !== 1 ? 's' : '';
	const ies = nuke.length !== 1 ? 'ies' : 'y';

	if (!process.argv.includes('--commit')) {
		for (const file of nuke) {
			console.log(file);
		}
		console.log(`\nFound ${nuke.length} file${s}/director${ies} to nuke\n`);
		console.log('Run "gulp clean --commit" to perform the actual delete\n');
		return;
	}

	for (const file of nuke) {
		console.log('Deleting:', file);
		fs.removeSync(file);
	}

	console.log(`\nNuked ${nuke.length} file${s}/director${ies}\n`);
};

exports['ci-clean'] = async function ciClean() {
	if (process.env.JENKINS) {
		const nuke = getFilesToNuke();
		for (const file of nuke) {
			console.log('Deleting:', file);
			fs.removeSync(file);
		}
		console.log(`\nNuked ${nuke.length} file${s}/director${ies}\n`);
	}
};

exports.stats = async function stats() {
	displayStats({
		stats: computeSloc(),
		testStats: computeSloc('test')
	});
};

exports.upgrade = async function upgrade() {
	let results;
	let recheck = true;

	// `gulp upgrade` just runs `yarn upgrade`... it does not update the dependency versions in the packages

	// `gulp upgrade -u` will update the package.json, run yarn, then run yarn upgrade

	if (process.argv.includes('-u')) {
		results = await checkPackages({ skipSecurity: true });
		const { outOfDate } = results;
		if (outOfDate.length) {
			await upgradeDeps(outOfDate);
			await run('yarn', [], { cwd: process.cwd(), shell: true });
		} else {
			log('Direct dependencies up-to-date');
			recheck = false;
		}
	}

	// at this point, all of our direct dependencies should be up-to-date, but deep dependencies
	// aren't, so we need to run `yarn upgrade`

	await run('yarn', [ 'upgrade' ], { cwd: process.cwd(), shell: true });

	if (recheck) {
		results = await checkPackages({ skipSecurity: true });
	}

	renderPackages(results);
};

exports.ls = exports.list = async function listPackages() {
	for (const [ name, pkg ] of Object.entries(getDepMap())) {
		console.log(`${cyan(name)}@${pkg.version}`);
		for (const dep of Object.keys(pkg.deps)) {
			console.log(`    ${gray(dep)}`);
		}
	}
};

/*
 * lint tasks
 */
exports.lint = series(cyclic, function lint() {
	return gulp
		.src(path.join(__dirname, 'packages/*/gulpfile.js'))
		.pipe(debug({ title: 'Linting project:' }))
		.pipe(plumber())
		.pipe(chug({ tasks: [ 'lint' ] }));
});

/*
 * build tasks
 */
const build = exports.build = series(cyclic, async function build() {
	return runLerna([ 'run', 'build' ]);
});

exports.package = series(build, function pkg() {
	return runLerna([ 'run', '--parallel', 'package' ]);
});

/*
 * unit test tasks
 */
let origHomeDir = process.env.HOME;
let tmpHomeDir = null;

async function runTests(cover, all) {
	try {
		process.env.APPCD_TEST_GLOBAL_PACKAGE_DIR = path.join(__dirname, 'packages');
		process.env.SPAWN_WRAP_SHIM_ROOT = origHomeDir;
		process.env.SNOOPLOGG = '*';

		tmpHomeDir = tmp.dirSync({
			mode: '755',
			prefix: 'appcd-test-home-',
			unsafeCleanup: true
		}).name;

		log(`Protecting home directory, overriding HOME with temp dir: ${cyan(tmpHomeDir)}`);
		process.env.HOME = process.env.USERPROFILE = tmpHomeDir;
		if (process.platform === 'win32') {
			process.env.HOMEDRIVE = path.parse(tmpHomeDir).root.replace(/[\\/]/g, '');
			process.env.HOMEPATH = tmpHomeDir.replace(process.env.HOMEDRIVE, '');
		}

		log('Linking plugins...');
		spawnSync(process.execPath, [ 'packages/appcd/bin/appcd', 'pm', 'link' ], { stdio: 'inherit' });

		require('./packages/appcd-gulp/src/test-runner').runTests({ root: __dirname, projectDir: __dirname, cover, all });
	} finally {
		// restore home directory so that we can delete the temp one
		if (tmpHomeDir) {
			log(`Removing temp home directory: ${cyan(tmpHomeDir)}`);
			fs.removeSync(tmpHomeDir);
		}

		log(`Restoring home directory: ${cyan(origHomeDir)}`);
		process.env.HOME = origHomeDir;
	}
}

exports['integration-test']      = series(nodeInfo, build, function test()     { return runTests(); });
exports['integration-test-only'] = series(nodeInfo,        function test()     { return runTests(); });
exports['integration-coverage']  = series(nodeInfo,        function coverage() { return runTests(true); });
exports['coverage']              = series(nodeInfo, build, function coverage() { return runTests(true, true); });
exports['coverage-ci']           = exports['coverage'];
exports['coverage-only']         = series(nodeInfo,        function coverage() { return runTests(true, true); });

/*
 * watch/debug tasks
 */
async function startDaemon() {
	return spawn(
		process.execPath,
		[
			'packages/appcd/bin/appcd',
			'start',
			'--debug',
			'--config', '{ \"telemetry\": { \"environment\": \"development\" } }'
		],
		{
			env: {
				...process.env,
				APPCD_ENV: 'development'
			},
			stdio: 'inherit'
		}
	);
}

function stopDaemon() {
	spawnSync(process.execPath, [ 'packages/appcd/bin/appcd', 'stop' ], { stdio: 'inherit' });
}

exports['start-daemon'] = async () => {
	log('Starting daemon in debug mode');
	console.log('-----------------------------------------------------------');
	startDaemon();
};

async function watchOnly(child) {
	await new Promise(resolve => {
		let restarting = false;
		let stopping = false;

		const restart = async (path, fn) => {
			log('Detected change: ' + cyan(path));
			restarting = true;

			stopDaemon();

			if (typeof fn === 'function') {
				await fn();
			}

			if (child) {
				child.removeListener('close', cleanup);
			}
			child = (await startDaemon()).on('close', cleanup);

			restarting = false;
		};

		const binWatcher = gulp
			.watch(`${__dirname}/packages/appcd/bin/*`)
			.on('all', (type, path) => restart(path));

		const srcWatcher = gulp
			.watch(`${__dirname}/packages/*/src/**/*.js`)
			.on('all', async (type, path) => {
				// FIXME: There's almost certainly a better way of doing this than replacing \\ with /
				path = path.replace(/\\/g, '/');
				const m = path.match(new RegExp(`^(${__dirname.replace(/\\/g, '/')}/(packages/([^\/]+)))`));
				if (m) {
					await restart(path, () => {
						return buildDepList(m[2]).reduce((promise, dir) => {
							return promise.then(() => new Promise((resolve, reject) => {
								console.log();
								log(cyan('Rebuilding ' + dir));
								gulp
									.src(__dirname + '/' + dir + '/gulpfile.js')
									.pipe(chug({ tasks: [ 'build' ] }))
									.on('finish', () => resolve());
							}));
						}, Promise.resolve());
					});
				}
			});

		const cleanup = () => {
			if (!restarting && !stopping) {
				stopping = true;
				if (child) {
					child.removeListener('close', cleanup);
				}
				try {
					binWatcher.close();
				} catch (e) {}
				try {
					srcWatcher.close();
				} catch (e) {}
				resolve();
			}
		};

		if (child) {
			child.on('close', cleanup);
		}

		process.on('SIGINT', cleanup);
	});
}

exports.watch = series(build, async function watch() {
	return watchOnly(await startDaemon());
});

exports.debug = series(build, function debugDaemon() {
	spawnSync(process.execPath, [ 'packages/appcd/bin/appcd', 'start', '--debug-inspect', '--config', '{ \"telemetry\": { \"environment\": \"development\" } }' ], { stdio: 'inherit' });
});

exports.default = async () => {
	console.log('\nAvailable tasks:');
	const table = new Table({
		chars: cliTableChars,
		head: [],
		style: {
			head: [ 'bold' ],
			border: []
		}
	});

	table.push([ cyan('build'),            'performs a full build' ]);
	table.push([ cyan('watch'),            'builds all packages, then starts watching them' ]);
	table.push([ cyan('watch-only'),       'starts watching all packages to perform build' ]);
	table.push([ cyan('check'),            'checks missing/outdated dependencies/link, security issues, and code stats' ]);
	table.push([ cyan('cyclic'),           'detects cyclic dependencies (which are bad) in appcd packages' ]);
	table.push([ cyan('stats'),            'displays stats about the code' ]);
	table.push([ cyan('upgrade'),          'detects latest npm deps, updates package.json, and runs upgrade' ]);

	console.log(table.toString() + '\n');
};

/*
 * helper functions
 */

function buildDepList(pkg) {
	const depmap = getDepMap();
	const list = [ pkg ];
	const paths = {};

	(function scan(pkg) {
		for (const dir of Object.keys(depmap)) {
			if (depmap[dir].deps[pkg]) {
				if (paths[dir]) {
					list.splice(list.indexOf(dir), 1);
				} else {
					paths[dir] = 1;
				}
				list.push(dir);
				scan(dir);
			}
		}
	}(pkg));

	return list;
}

async function cyclic() {
	const results = checkCyclic();
	const pkgs = Object.keys(results);
	if (pkgs.length) {
		for (const name of pkgs.sort()) {
			console.log(name);
			for (const deps of results[name]) {
				console.log('  > ' + deps.map((s, i, a) => i + 1 === a.length ? red(s) : s).join(' > '));
			}
			console.log();
		}
		const e = new Error(red(`Found ${pkgs.length} package${pkgs.length === 1 ? '' : 's'} with cyclic dependencies!`));
		e.showStack = false;
		throw e;
	} else {
		console.log('No cyclic dependencies found');
	}
};
exports.cyclic = cyclic;

let cyclicCache = null;

function checkCyclic() {
	if (cyclicCache) {
		return cyclicCache;
	}

	const packages = getDepMap();
	const cyclic = {};

	function test(name, trail) {
		if (!trail) {
			trail = [ name ];
		} else if (trail.includes(name)) {
			if (!cyclic[trail[0]]) {
				cyclic[trail[0]] = [];
			}
			cyclic[trail[0]].push([ ...trail.slice(1), name ]);
			return;
		} else {
			trail.push(name);
		}

		for (const dep of Object.keys(packages[name].deps)) {
			test(dep, trail);
		}

		trail.pop();
	}

	for (const name of Object.keys(packages)) {
		test(name);
	}

	return cyclicCache = cyclic;
}

const runLimit = promiseLimit(3);

function run(cmd, args, opts) {
	return runLimit(() => new Promise((resolve, reject) => {
		opts || (opts = {});
		opts.cwd || (opts.cwd = process.cwd());
		if (opts.quiet) {
			opts.stdio = 'ignore';
		} else {
			log('Running: CWD=' + opts.cwd, cmd, args.join(' '));
		}
		const child = spawn(cmd, args, opts);
		let out = '';
		let err = '';
		if (!opts.quiet) {
			child.stdout.on('data', data => out += data.toString());
			child.stderr.on('data', data => err += data.toString());
		}
		child.on('close', code => {
			resolve({
				status: code,
				stdout: out,
				stderr: err
			});
		});
	}));
}

function runLerna(args) {
	let execPath = '';
	if (isWindows) {
		execPath = path.join(__dirname, 'node_modules', '.bin', 'lerna.cmd');
	} else {
		args.unshift('./node_modules/.bin/lerna');
		execPath = process.execPath;
	}
	log(`Running ${execPath} ${args.join(' ')}`);
	spawnSync(execPath, args, { stdio: 'inherit' });
}

async function checkPackages({ skipSecurity } = {}) {
	const cleanVersionRegExp = /^[\^~><=v\s]*/;

	// const packages = JSON.parse(fs.readFileSync('packages.json'));
	// const dependencies = JSON.parse(fs.readFileSync('dependencies.json'));

	const packages = {};
	const dependencies = {};
	const tasks = [];

	log('Checking packages...');

	for (let file of globule.find([ './package.json', 'packages/*/package.json' ])) {
		file = path.resolve(file);
		const packagePath = path.dirname(file);
		const pkgJson = JSON.parse(fs.readFileSync(file));
		const info = {
			name: pkgJson.name,
			path: packagePath,
			package: pkgJson,
			appcdDependencies: [],
			dependencies: {},
			devDependencies: {},
			optionalDependencies: {},
			deprecated: {},
			securityIssues: []
		};

		// if (!skipSecurity) {
		// 	tasks.push([ 'retire', packagePath ]);
		// }

		for (const type of [ 'dependencies', 'devDependencies', 'optionalDependencies' ]) {
			if (pkgJson[type]) {
				info[type] = {};

				for (const [ dep, required ] of Object.entries(pkgJson[type])) {
					// figure out if the depenency is installed and what version
					let installed = false;
					try {
						let dir = packagePath;
						let last = null;
						while (dir !== last) {
							let depPkgJsonFile = path.join(dir, 'node_modules', dep, 'package.json');
							if (fs.existsSync(depPkgJsonFile)) {
								installed = JSON.parse(fs.readFileSync(depPkgJsonFile)).version;
								break;
							}
							last = dir;
							dir = path.dirname(dir);
						}
					} catch (e) {}

					if (!dependencies[dep]) {
						dependencies[dep] = {
							deprecated:      null,
							latest:          null,
							latestTimestamp: null,
							next:            null,
							nextTimestamp:   null,
							versions:        {}
						};
					}

					const version = required.replace(cleanVersionRegExp, '');
					if (!dependencies[dep].versions[version]) {
						dependencies[dep].versions[version] = [];
					}

					// check if the dependency is an appcd-* dependency
					if (appcdPackages.has(dep)) {
						info.appcdDependencies.push(dep);
					}

					tasks.push([ 'npm info', dep ]); // gets most recent version and deprecation

					info[type][dep] = {
						installed,
						required
					};
				}
			}
		}

		packages[packagePath] = info;
	}

	// at this point, we have a map of all packages and their info, a appcd dep map, and a list of
	// tasks to perform async

	let taskCounter = 1;
	const totalTasks = tasks.length;

	log(`Found ${cyan(Object.keys(packages).length)} packages`);
	log(`Found ${cyan(Object.keys(dependencies).length)} dependencies`);
	log(`Processing ${cyan(totalTasks)} tasks`);

	const progress = require('progress');
	const bar = new progress('  [:bar] :percent :etas', {
		clear: true,
		complete: '=',
		incomplete: ' ',
		width: 50,
		total: totalTasks
	});

	// console.log(util.inspect(packages, { depth: null }));
	// console.log(dependencies);
	// console.log(tasks);

	const limit = promiseLimit(20);

	await Promise.all(tasks.map(task => limit(async () => {
		const action = task[0];
		const dir = task[1];
		const pkg = task[1];
		const version = task[2];

		// log(`Running task ${taskCounter++}/${totalTasks}: ${action} ${pkg}${version ? `@${version}` : ''}`);

		switch (action) {
			case 'retire':
				let { execPath } = process;
				const args = [
					'--node',
					'--package',
					'--outputformat', 'json',
					'--outputpath', 'retire_output.json'
				];
				if (isWindows) {
					execPath = path.join(__dirname, 'node_modules', '.bin', 'retire.cmd');
				} else {
					args.unshift(path.join(__dirname, 'node_modules', '.bin', 'retire'));
				}

				return run(execPath, args, { cwd: dir, quiet: true })
					.then(result => new Promise(resolve => {
						const outFile = path.join(dir, 'retire_output.json');
						const allIssues = result.status === 13 ? JSON.parse(fs.readFileSync(outFile)) : null;
						try {
							fs.unlinkSync(outFile);
						} catch (e) {}

						if (result.status === 13) {
							for (const issues of allIssues) {
								for (const issue of issues.results) {
									let obj = issue;
									while (obj.level > 1) {
										obj = obj.parent;
									}

									if (obj) {
										const dep = obj.component;
										const version = obj.version;
										issue.retire = true;
										if (!dependencies[dep].versions[version]) {
											dependencies[dep].versions[version] = [];
										}
										dependencies[dep].versions[version].push(issue);
									}
								}
							}
						} else if (result.status !== 0) {
							log(result.stderr);
						}

						bar.tick();
						resolve();
					}));
				break;

			case 'npm info':
				try {
					let info = await libnpm.fetch(`/${pkg}`);
					info = await info.json();
					const latest = info['dist-tags'] && info['dist-tags'].latest;
					const next = info['dist-tags'] && info['dist-tags'].next || null;
					dependencies[pkg].latest          = latest;
					dependencies[pkg].latestTimestamp = info.time[latest] || null;
					dependencies[pkg].next            = next;
					dependencies[pkg].nextTimestamp   = next && info.time[next] || null;
					dependencies[pkg].deprecated      = info.versions[latest].deprecated;
				} catch (error) {
					log(yellow(`npm lookup failed for ${pkg} ${error}`));
				}
				bar.tick();
				break;
			default:
				bar.tick();
		}
	})));

	// console.log('writing');
	// fs.writeFileSync('packages.json', JSON.stringify(packages, null, '\t'));
	// fs.writeFileSync('dependencies.json', JSON.stringify(dependencies, null, '\t'));
	// console.log('done');

	const results = {
		packages:                 packages,
		dependencies:             dependencies,
		missingDeps:              0,
		securityIssues:           0,
		deprecated:               0,
		cyclic:                   checkCyclic(),
		outOfDate:                [],
		upgradeAvailable:         [],
		stats:                    computeSloc(),
		testStats:                computeSloc('test')
	};

	log('Processing packages...');

	for (const dep of Object.values(dependencies)) {
		if (dep.deprecated) {
			results.deprecated++;
		}

		for (const issues of Object.values(dep.versions)) {
			results.securityIssues += issues.length;
		}
	}

	for (const key of Object.keys(packages)) {
		const pkg = packages[key];

		for (const type of [ 'dependencies', 'devDependencies', 'optionalDependencies' ]) {
			if (!pkg[type]) {
				continue;
			}

			for (const name of Object.keys(pkg[type])) {
				const dep = pkg[type][name];
				const { installed, required } = dep;
				const { deprecated, latest, latestTimestamp, next, nextTimestamp } = dependencies[name];

				if (!installed) {
					results.missingDeps++;
					dep.status = 'not installed';
				}

				if (required !== 'latest' && required !== 'next' && required !== '*') {
					// is the dependency up-to-date?
					if (dontUpdate.includes(name)) {
						dep.status = (dep.status ? `${dep.status}, ` : '') + 'skipping latest';
					} else {
						const req = required ? required.replace(cleanVersionRegExp, '') : null;
						if (req && latest && semver.lt(req, latest)) {
							dep.status = (dep.status ? ', ' : '') + 'out-of-date';

							const m = required.match(/^(\^|~|>|>=)/);
							results.outOfDate.push({
								path: key,
								name,
								current: required,
								latest: (m ? m[1] : '') + latest,
								latestTimestamp,
								next: next ? `^${next}` : null,
								nextTimestamp
							});
						}

						if (installed && latest && semver.lt(installed, latest)) {
							dep.status = (dep.status ? `${dep.status}, ` : '') + 'update available';

							const m = required.match(/^(\^|~|>|>=)/);
							results.upgradeAvailable.push({
								path: key,
								name,
								current: required,
								latest: (m ? m[1] : '') + latest,
								latestTimestamp,
								next: next ? `^${next}` : null,
								nextTimestamp
							});
						}
					}
				}

				if (deprecated) {
					pkg.deprecated[name] = deprecated;
					dep.status = (dep.status ? `${dep.status}, ` : '') + 'deprecated';
				}

				if (!dep.status) {
					dep.status = 'ok';
				}
			}
		}
	}

	return results;
}

function renderPackages(results) {
	console.log();

	const { dependencies, packages } = results;

	const typeLabels = {
		dependencies: 'Dependencies',
		devDependencies: 'Dev Dependencies',
		optionalDependencies: 'Optional Dependencies'
	};

	let table;

	for (const key of Object.keys(packages).sort()) {
		const pkg = packages[key];
		console.log(magenta(path.relative(path.dirname(__dirname), path.join(key, 'package.json'))) + '\n');

		table = new Table({
			chars: cliTableChars,
			head: [ 'Name', 'Required', 'Installed', 'Latest', 'Next', 'Status' ],
			style: {
				head: [ 'bold' ],
				border: []
			}
		});

		[ 'dependencies', 'devDependencies', 'optionalDependencies' ].forEach(type => {
			if (pkg[type] && Object.keys(pkg[type]).length) {
				table.push([ { colSpan: 6, content: gray(typeLabels[type]) } ]);

				for (const name of Object.keys(pkg[type])) {
					const dep = pkg[type][name];
					const { latest, next } = dependencies[name];
					const packageName = '  ' + name;

					if (dep.status === 'ok') {
						table.push([ packageName, dep.required, dep.installed, latest, next, green(dep.status) ]);
					} else if (dep.status.indexOf('out-of-date') !== -1) {
						table.push([ packageName, dep.required, red(dep.installed), green(latest), next, red(dep.status) ]);
					} else if (dep.status === 'deprecated') {
						table.push([ packageName, dep.required, dep.installed, latest, next, red(dep.status) ]);
					} else if (dep.status === 'skipping latest') {
						table.push([ packageName, dep.required, dep.installed, latest, next, yellow(dep.status) ]);
					} else {
						table.push([ packageName, dep.required, red(dep.installed), latest, next, red(dep.status) ]);
					}
				}
			}
		});

		console.log(table.toString() + '\n');

		if (Object.keys(pkg.securityIssues).length) {
			console.log(gray(' Node Security Issues:'));
			const treePrinter = require('tree-printer');
			for (const issue of pkg.securityIssues) {
				console.log(JSON.stringify(issue));
				// for (const ver of Object.keys(pkg.nodeSecurityIssues[name])) {
				// 	const info = pkg.nodeSecurityIssues[name][ver];
				// 	const tools = [];
				// 	if (info.retire) {
				// 		tools.push('retire');
				// 	}
				//
				// 	console.log('   • ' + bold(name + '@' + ver) + ' ' + gray('(' + tools.join(', ') + ')'));
				//
				//
				// 	table = new Table({
				// 		chars: cliTableChars,
				// 		head: [ gray('Vulnerability'), gray('Info'), gray('Vulnerable'), gray('Patched'), gray('Published'), gray('Updated') ],
				// 		style: {
				// 			head: [ 'bold' ],
				// 			border: []
				// 		}
				// 	});
				//
				// 	for (const advisory of Object.keys(info.vulnerabilities)) {
				// 		const issue = info.vulnerabilities[advisory];
				//
				// 		table.push([
				// 			red(issue.title),
				// 			advisory,
				// 			issue.vulnerable_versions || 'n/a',
				// 			issue.patched_versions || 'n/a',
				// 			issue.publish_date ? new Date(issue.publish_date).toLocaleDateString() : 'n/a',
				// 			issue.updated_at ? new Date(issue.updated_at).toLocaleDateString() : 'n/a'
				// 		]);
				//
				// 		console.log(table.toString().split('\n').map(s => '    ' + s).join('\n'));
				// 	}
				//
				// 	const tree = [];
				// 	for (const pp of Object.values(info.paths)) {
				// 		let n = tree;
				// 		for (const p of pp) {
				// 			let found = false;
				// 			for (let i = 0; i < n.length; i++) {
				// 				if (n[i].name === p) {
				// 					found = true;
				// 					n = n[i].children;
				// 				}
				// 			}
				//
				// 			if (!found) {
				// 				n.push({
				// 					name: p,
				// 					children: []
				// 				});
				// 			}
				// 		}
				// 	}
				//
				// 	console.log(treePrinter(tree).split('\n').slice(1).map(l => '       ' + l).join('\n'));
				// }
			}
		}

		if (Object.keys(pkg.deprecated).length) {
			console.log('\n' + gray(' Deprecations:'));
			table = new Table({
				chars: cliTableChars,
				head: [ gray('Package'), gray('Note') ],
				style: {
					head: [ 'bold' ],
					border: []
				}
			});
			for (const name of Object.keys(pkg.deprecated)) {
				table.push([ name, pkg.deprecated[name] ]);
			}
			console.log(table.toString().trim().split('\n').map(s => '   ' + s).join('\n'));
		}

		console.log();
	}

	console.log(magenta('Cyclic Dependencies') + '\n');
	const cyclicPkgs = Object.keys(results.cyclic);
	const cyclicDepCount = cyclicPkgs.length;
	if (cyclicDepCount) {
		for (const name of cyclicPkgs.sort()) {
			console.log(` ${name}`);
			for (const deps of results.cyclic[name]) {
				console.log('   > ' + deps.map((s, i, a) => i + 1 === a.length ? red(s) : s).join(' > '));
			}
			console.log();
		}
		console.log(red(` Found ${cyclicDepCount} package${cyclicDepCount === 1 ? '' : 's'} with cyclic dependencies!`));
	} else {
		console.log(' No cyclic dependencies found');
	}
	console.log();

	displayStats(results);

	console.log(magenta('Summary') + '\n');
	table = new Table({ chars: cliTableChars, head: [], style: { head: [ 'bold' ], border: [] } });
	table.push([
		'Missing dependencies',
		results.missingDeps > 0 ? red(results.missingDeps) : green(results.missingDeps)
	]);
	table.push([
		'Out-of-date',
		results.outOfDate.length > 0 ? red(results.outOfDate.length) : green(results.outOfDate.length)
	]);
	table.push([
		'Upgradable Packages',
		results.upgradeAvailable.length > 0 ? red(results.upgradeAvailable.length) : green(results.upgradeAvailable.length)
	]);
	table.push([
		'Deprecated',
		results.deprecated > 0 ? red(results.deprecated) : green(results.deprecated)
	]);
	table.push([
		'Top Level Node Security Issues',
		results.securityIssues > 0 ? red(results.securityIssues) : green(results.securityIssues)
	]);
	table.push([
		'Cyclic Dependencies',
		cyclicDepCount > 0 ? red(cyclicDepCount) : green(cyclicDepCount)
	]);
	console.log(table.toString() + '\n');

	const updates = [
		[ results.outOfDate, 'Out-of-Date Dependencies', 'gulp upgrade -u' ],
		[ results.upgradeAvailable, 'Upgradable Installed Packages', 'gulp upgrade' ]
	];

	for (const [ list, title, cmd ] of updates) {
		if (list.length) {
			console.log(magenta(title) + '\n');

			table = new Table({
				chars: cliTableChars,
				head: [ 'Component', 'Package', 'From', 'To' ],
				style: {
					head: [ 'bold', 'gray' ],
					border: []
				}
			});
			for (const pkg of list) {
				const rel = path.relative(__dirname, pkg.path) || path.basename(pkg.path);
				table.push([
					rel,
					magenta(pkg.name),
					pkg.current,
					'→',
					hlVer(pkg.latest, pkg.current) + (pkg.latestTimestamp ? gray(` (published ${new Date(pkg.latestTimestamp).toDateString()})`) : '')
				]);
			}
			console.log(table.toString() + '\n');
			console.log(`Run ${cyan(cmd)} to update\n`);
		}
	}
}

function displayStats(results) {
	console.log(magenta('Source Code Stats') + '\n');

	let table = new Table({ chars: cliTableChars, head: [], style: { head: [ 'bold' ], border: [] } });
	let stats = results.stats;
	table.push([ 'Physical lines',       { hAlign: 'right', content: green(formatNumber(stats.total)) }, '' ]);
	table.push([ 'Lines of source code', { hAlign: 'right', content: green(formatNumber(stats.source)) }, gray(formatPercentage(stats.source / stats.total * 100)) ]);
	table.push([ 'Total comments',       { hAlign: 'right', content: green(formatNumber(stats.comment)) }, gray(formatPercentage(stats.comment / stats.total * 100)) ]);
	table.push([ 'Single-lines',         { hAlign: 'right', content: green(formatNumber(stats.single)) }, '' ]);
	table.push([ 'Blocks',               { hAlign: 'right', content: green(formatNumber(stats.block)) }, '' ]);
	table.push([ 'Mixed',                { hAlign: 'right', content: green(formatNumber(stats.mixed)) }, '' ]);
	table.push([ 'Empty lines',          { hAlign: 'right', content: green(formatNumber(stats.empty)) }, '' ]);
	table.push([ 'Todos',                { hAlign: 'right', content: green(formatNumber(stats.todo)) }, '' ]);
	table.push([ 'Number of files',      { hAlign: 'right', content: green(formatNumber(stats.files)) }, '' ]);
	console.log(table.toString() + '\n');

	console.log(magenta('Test Code Stats') + '\n');
	table = new Table({ chars: cliTableChars, head: [], style: { head: [ 'bold' ], border: [] } });
	stats = results.testStats;
	table.push([ 'Physical lines',       { hAlign: 'right', content: green(formatNumber(stats.total)) }, '' ]);
	table.push([ 'Lines of source code', { hAlign: 'right', content: green(formatNumber(stats.source)) }, gray(formatPercentage(stats.source / stats.total * 100)) ]);
	table.push([ 'Total comments',       { hAlign: 'right', content: green(formatNumber(stats.comment)) }, gray(formatPercentage(stats.comment / stats.total * 100)) ]);
	table.push([ 'Single-lines',         { hAlign: 'right', content: green(formatNumber(stats.single)) }, '' ]);
	table.push([ 'Blocks',               { hAlign: 'right', content: green(formatNumber(stats.block)) }, '' ]);
	table.push([ 'Mixed',                { hAlign: 'right', content: green(formatNumber(stats.mixed)) }, '' ]);
	table.push([ 'Empty lines',          { hAlign: 'right', content: green(formatNumber(stats.empty)) }, '' ]);
	table.push([ 'Todos',                { hAlign: 'right', content: green(formatNumber(stats.todo)) }, '' ]);
	table.push([ 'Number of files',      { hAlign: 'right', content: green(formatNumber(stats.files)) }, '' ]);
	console.log(table.toString() + '\n');
}

function hlVer(toVer, fromVer) {
	const version = [];

	let [ from, fromTag ] = fromVer.split(/-(.+)/);
	from = from.replace(/[^\.\d]/g, '').split('.').map(x => parseInt(x));

	let [ to, toTag ] = toVer.split(/-(.+)/);
	const toMatch = to.match(/^([^\d]+)?(.+)$/);
	to = (toMatch ? toMatch[2] : to).split('.').map(x => parseInt(x));

	const tag = () => {
		if (toTag) {
			const toNum = toTag.match(/\d+$/);
			const fromNum = fromTag && fromTag.match(/\d+$/);
			if (fromNum && parseInt(fromNum[0]) >= parseInt(toNum)) {
				return `-${toTag}`;
			} else {
				return green(`-${toTag}`);
			}
		}
		return '';
	};

	while (to.length) {
		if (to[0] > from[0]) {
			if (version.length) {
				return (toMatch && toMatch[1] || '') + version.concat(green(to.join('.') + tag())).join('.');
			}
			return green((toMatch && toMatch[1] || '') + to.join('.') + tag());
		}
		version.push(to.shift());
		from.shift();
	}

	return (toMatch && toMatch[1] || '') + version.join('.') + tag();
}

/**
 * Updates all package.json files with out-of-date dependencies.
 */
async function upgradeDeps(list) {
	const components = {};
	for (const pkg of list) {
		const pkgJsonFile = path.join(pkg.path, 'package.json');
		components[pkgJsonFile] || (components[pkgJsonFile] = {});
		components[pkgJsonFile][pkg.name] = pkg.latest;
	}

	let table;
	console.log();

	// first we update the various package.json files
	for (const pkgJsonFile of Object.keys(components)) {
		try {
			if (!fs.statSync(pkgJsonFile).isFile()) {
				throw new Error();
			}
		} catch (e) {
			log(red(`Unable to locate ${pkgJsonFile}`));
			continue;
		}

		let pkgJson;
		try {
			pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile));
		} catch (e) {
			log(red(`Unable to locate ${pkgJsonFile}`));
			continue;
		}

		console.log(magenta(pkgJsonFile));

		table = new Table({
			chars: cliTableChars,
			head: [],
			style: {
				head: [],
				border: []
			}
		});

		for (const packageName of Object.keys(components[pkgJsonFile])) {
			[ 'dependencies', 'devDependencies', 'optionalDependencies' ].forEach(type => {
				if (pkgJson[type] && pkgJson[type].hasOwnProperty(packageName)) {
					table.push([ packageName, pkgJson[type][packageName], '→', hlVer(components[pkgJsonFile][packageName], pkgJson[type][packageName]) ]);
					pkgJson[type][packageName] = components[pkgJsonFile][packageName];
				}
			});
		}

		console.log(table.toString() + '\n');

		fs.writeFileSync(pkgJsonFile, JSON.stringify(pkgJson, null, 2) + '\n');
	}
}

function computeSloc(type) {
	const srcDirs = [];
	const sloc = require('sloc');
	const supported = sloc.extensions;
	const counters = { total: 0, source: 0, comment: 0, single: 0, block: 0, mixed: 0, empty: 0, todo: 0, files: 0 };

	globule
		.find([ 'packages/*/package.json' ])
		.forEach(pkgJson => {
			const dir = path.join(path.dirname(path.resolve(pkgJson)), type || 'src');
			try {
				if (fs.statSync(dir).isDirectory()) {
					srcDirs.push(dir + '/*');
				}
			} catch (e) {}
		});

	globule
		.find(srcDirs)
		.forEach(file => {
			const ext = path.extname(file).replace(/^\./, '');
			if (supported.indexOf(ext) === -1) {
				return;
			}

			const stats = sloc(fs.readFileSync(file, 'utf8'), ext);
			Object.getOwnPropertyNames(stats).forEach(function (key) {
				counters[key] += stats[key];
			});
			counters.files++;
		});

	return counters;
}

function formatNumber(num, dontSign) {
	const n = parseFloat(num);
	if (isNaN(n)) {
		return num;
	}
	const pos = String(Math.abs(n)).split('.');
	const val = pos[0].replace(/./g, function (c, i, a) {
	    return i && c !== '.' && ((a.length - i) % 3 === 0) ? ',' + c : c;
	}) + (pos.length > 1 ? ('.' + pos[1]) : '');

	return dontSign && n < 0 ? `(${val})` : val;
}

function formatPercentage(value) {
	return value.toFixed(1) + '%';
}

let depmapCache = null;

function getDepMap(allPackages) {
	if (depmapCache) {
		return depmapCache;
	}

	const depmap = {};
	const graph = [];

	globule
		.find([ 'packages/*/package.json' ])
		.forEach(pkgJsonFile => {
			const pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile));
			const name = pkgJson.name;
			depmap[name] = {
				version: pkgJson.version,
				deps: {}
			};

			if (pkgJson.dependencies) {
				for (const [ dep, ver ] of Object.entries(pkgJson.dependencies)) {
					if (allPackages || appcdPackages.has(dep)) {
						depmap[name].deps[dep] = ver;
					}
					if (appcdPackages.has(dep)) {
						graph.push([ name, dep ]);
					}
				}
			}

			if (pkgJson.devDependencies) {
				for (const [ dep, ver ] of Object.entries(pkgJson.devDependencies)) {
					if (allPackages || appcdPackages.has(dep)) {
						depmap[name].deps[dep] = ver;
					}
					if (appcdPackages.has(dep)) {
						graph.push([ name, dep ]);
					}
				}
			}
		});

	// sort the depmap
	depmapCache = {};

	for (const name of toposort(graph).reverse()) {
		depmapCache[name] = depmap[name];
	}

	return depmapCache;
}

exports['deps-changelog'] = async function depChangelog() {
	const depmap = getDepMap(true);

	return Object.keys(depmap)
		.reduce((promise, name) => {
			return promise.then(() => new Promise(async (resolve, reject) => {
				let info;
				try {
					info = await libnpm.packument(name);
				} catch (error) {
					log(yellow(`npm lookup failed for ${name}: ${err.message}`));
					return;
				}
				const latestVer = info['dist-tags'].latest;
				const latestVerData = info.versions[latestVer];
				const deps = Object.assign({}, latestVerData.dependencies, latestVerData.devDependencies);
				const delta = {};

					for (const [ dep, localDepVer ] of Object.entries(depmap[name].deps)) {
						if ((deps[dep] && deps[dep] !== localDepVer) || (depmap[dep] && depmap[dep].version !== localDepVer)) {
							delta[dep] = { from: deps[dep].replace(/[^\d.]/g, ''), to: localDepVer.replace(/[^\d.]/g, '') };
						}
					}

					if (Object.keys(delta).length) {
						console.log(name);
						console.log(`  Latest Version; ${latestVer}`);
						console.log(`  Local Version:  ${depmap[name].version}\n`);

						if (depmap[name].version === latestVer) {
							console.log('NEEDS VERSION BUMP IN PACKAGE.JSON');
						}
						for (const dep of Object.keys(delta).sort()) {
							if (depmap[dep] && depmap[dep].version.replace(/[^\d.]/g, '') !== delta[dep].to) {
								console.log(`DEPENDENCY NEEDS VERSION BUMP IN PACKAGE.JSON: ${dep} ${delta[dep].to} -> ${depmap[dep].version}`);
							}
						}
						console.log();

						let change = ' * Updated dependencies:\n';
						for (const dep of Object.keys(delta).sort()) {
							const from = delta[dep].from.replace(/[^\d.]/g, '');
							if (depmap[dep]) {
								change += `   - ${dep} ${from} -> ${depmap[dep].version}\n`;
							} else {
								change += `   - ${dep} ${from} -> ${delta[dep].to}\n`;
							}
						}

						const changelog = path.join(__dirname, 'packages', name, 'CHANGELOG.md');
						if (!fs.existsSync(changelog) || fs.readFileSync(changelog).toString().indexOf(change) === -1) {
							console.log(`${change}\n\n`);
						}
					}

				resolve();
			}));
		}, Promise.resolve());
};

exports['release-notes'] = async function releaseNotes() {
	const https = require('https');
	const tar = require('tar-stream');
	const zlib = require('zlib');

	const packages = {};
	const re = /^appcd-(?!plugin-)/;
	const tempDir = tmp.dirSync({
		mode: '755',
		prefix: 'appcd-release-notes-',
		unsafeCleanup: true
	}).name;
	const cacheDir = path.join(__dirname, '.npm-info');

	await fs.mkdirs(cacheDir);

	const fetch = async name => {
		const cacheFile = path.join(cacheDir, `${name}.json`);
		let info;

		if (fs.existsSync(cacheFile)) {
			log(`Fetching ${cyan(name)} from cache`);
			const s = fs.readFileSync(cacheFile, 'utf8');
			info = s ? JSON.parse(s) : null;
		} else {
			log(`Fetching ${cyan(name)}`);
			const { status, stdout, stderr } = spawnSync('npm', [ 'view', name, '--json' ]);
			if (status) {
				console.error('Failed to get package info:');
				console.error(stdout.toString());
				console.error(stderr.toString());
				process.exit(1);
			}
			fs.writeFileSync(cacheFile, stdout.toString());

			info = s ? JSON.parse(s) : null;
		}

		// if more than one is returned, get the latest
		if (Array.isArray(info)) {
			let pkg;
			for (const i of info) {
				if (!pkg || semver.gt(i.version, pkg.version)) {
					pkg = i;
				}
			}
			info = pkg;
		}

		return info;
	};

	const getPackageInfo = async (name, ver) => {
		const info = await fetch(`${name}@${ver}`);
		if (!info || packages[name]) {
			return info;
		}

		ver = info.version;

		log(`Initializing new package ${name}`);
		packages[name] = { latest: null, versions: {} };

		log(`  Versions: ${info.versions.join(', ')}`);
		for (const version of info.versions) {
			if (!packages[name].versions[version] && semver.valid(version) && semver.gt(version, '0.0.0')) {
				const { prerelease } = semver.parse(version);
				if (!prerelease || !prerelease.length) {
					log(`  Initializing pacakge ${name}@${version}`);
					const verInfo = await fetch(`${name}@${version}`);
					if (verInfo) {
						packages[name].versions[version] = { changelog: null, deps: {}, ts: info.time[version], version };
						for (const type of [ 'dependencies', 'devDependencies' ]) {
							if (verInfo[type]) {
								for (const [ dep, range ] of Object.entries(verInfo[type])) {
									if (re.test(dep)) {
										const depInfo = await getPackageInfo(dep, range);
										if (depInfo) {
											log(`  ${dep}@${range} => ${depInfo.version}`);
											packages[name].versions[version].deps[dep] = depInfo.version;
										} else {
											log(`  ${dep}@${range} not found! Parent ${name}@${ver}`);
										}
									}
								}
							}
						}
					}
				}
			}
		}

		return info;
	};

	const processChangelog = (name, changelog) => {
		const changes = changelog.split('\n\n#').map((s, i) => `${i ? '#' : ''}${s}`.trim());
		for (const chunk of changes) {
			const m = chunk.match(/^# v?([^\s\n]*)[^\n]*\n+(.+)$/s);
			if (!m) {
				continue;
			}

			if (packages[name].versions[m[1]]) {
				packages[name].versions[m[1]].changelog = m[2];
			} else {
				log(red(`Package ${name} does not have a version ${m[1]}!`));
			}
		}
	};

	try {
		// Step 1: get all the `appcd` releases and their `appcd-*` dependencies
		const { versions } = await fetch('appcd');
		for (const ver of versions) {
			if (semver.valid(ver) && semver.gt(ver, '0.0.0')) {
				const { prerelease } = semver.parse(ver);
				if (!prerelease || !prerelease.length) {
					await getPackageInfo('appcd', ver);
				}
			}
		}

		// Step 2: add in the local packages
		const local = {};
		for (const subdir of fs.readdirSync(path.join(__dirname, 'packages'))) {
			try {
				const pkgJson = fs.readJsonSync(path.join(__dirname, 'packages', subdir, 'package.json'));
				let { name, version } = pkgJson;
				local[name] = pkgJson;
				const changelogFile = path.join(__dirname, 'packages', subdir, 'CHANGELOG.md');
				const changelog = fs.existsSync(changelogFile) ? fs.readFileSync(changelogFile, 'utf8') : null;
				let ts = null;

				const m = changelog && changelog.match(/^# v([^\s]+)/);
				if (m && m[1] !== version) {
					// set release timestamp to now unless package is appcd, then make it 10 seconds older
					ts = new Date(Date.now() + (name === 'appcd' ? 10000 : 0));
					log(`Changing ${name} version from ${version} => ${m[1]}`);
					pkgJson.version = version = m[1];
				}

				if (!packages[name]) {
					packages[name] = { latest: null, versions: {} };
				}

				if (!packages[name] || !packages[name].versions[version]) {
					packages[name].local = true;
					packages[name].versions[version] = { changelog: null, deps: {}, local: true, ts, version };
				}

				if (changelog) {
					processChangelog(name, changelog);
				}
			} catch (e) {
				console.error(e);
			}
		}

		// Step 3: loop over local packages again and populate the deps
		for (const [ name, pkgJson ] of Object.entries(local)) {
			for (const type of [ 'dependencies', 'devDependencies' ]) {
				if (pkgJson[type]) {
					for (const [ dep, range ] of Object.entries(pkgJson[type])) {
						if (re.test(dep) && packages[dep]) {
							log(`  Finding ${dep}@${range} in packages to populate deps for ${name}`);
							let pkg;
							for (const [ ver, depInfo ] of Object.entries(packages[dep].versions)) {
								if (semver.satisfies(ver, range) && (!pkg || semver.gt(ver, pkg.version))) {
									pkg = depInfo;
								}
							}
							if (pkg) {
								packages[name].versions[pkgJson.version].deps[dep] = pkg.version;
							}
						}
					}
				}
			}
		}

		// Step 3: for each non-local package, fetch the latest npm package and extract the changelog
		for (const [ pkg, info ] of Object.entries(packages)) {
			if (!packages[pkg].latest) {
				packages[pkg].latest = Object.keys(info.versions).sort(semver.compare).pop();
			}

			if (info.local) {
				continue;
			}

			const changelogFile = path.join(cacheDir, `${pkg}@${info.latest}_CHANGELOG.md`);
			if (fs.existsSync(changelogFile)) {
				processChangelog(pkg, fs.readFileSync(changelogFile, 'utf8'));
			} else {
				const url = `https://registry.npmjs.org/${pkg}/-/${pkg}-${info.latest}.tgz`;
				const file = path.join(tempDir, `${pkg}-${info.latest}.tgz`);

				await new Promise((resolve, reject) => {
					const dest = fs.createWriteStream(file);
					dest.on('finish', () => dest.close(resolve));
					log(`Downloading ${cyan(url)}`);
					https.get(url, response => response.pipe(dest))
						.on('error', reject);
				});

				await new Promise((resolve, reject) => {
					const gunzip = zlib.createGunzip();
					const extract = tar.extract();

					extract.on('entry', (header, stream, next) => {
						if (header.name !== 'package/CHANGELOG.md') {
							stream.resume();
							return next();
						}

						let changelog = '';
						stream
							.on('data', chunk => changelog += chunk)
							.on('end', () => {
								fs.writeFileSync(changelogFile, changelog, 'utf8');
								processChangelog(pkg, changelog);
								next();
							})
							.on('error', reject)
							.resume();
					});

					extract.on('finish', resolve);
					extract.on('error', reject);

					log(`Extract changelog from ${cyan(file)}`);
					fs.createReadStream(file).pipe(gunzip).pipe(extract);
				});
			}
		}
	} finally {
		fs.removeSync(tempDir);
	}

	const { appcd } = packages;
	delete packages.appcd;
	const pkgs = Object.keys(packages).sort();

	// Step 4: loop over every `appcd` release and generate the changelog
	for (const ver of Object.keys(appcd.versions).sort(semver.compare)) {
		const { major, minor, patch } = semver.parse(ver);
		const cleanVersion = `${major}.${minor}.${patch}`;
		const dest = path.join(__dirname, 'docs', 'Release Notes', `Appc Daemon ${cleanVersion}.md`);
		const { changelog, local, ts } = appcd.versions[ver];
		const dt = ts ? new Date(ts) : new Date();
		const rd = ts && dt.toDateString().split(' ').slice(1);
		let s = `# Appc Daemon ${cleanVersion}\n\n## ${local ? 'Unreleased' : `${rd[0]} ${rd[1]}, ${rd[2]}`}\n\n`;

		if (patch === 0) {
			if (minor === 0) {
				s += 'This is a major release with breaking changes, new features, bug fixes, and dependency updates.\n\n';
			} else {
				s += 'This is a minor release with new features, bug fixes, and dependency updates.\n\n';
			}
		} else {
			s += 'This is a patch release with bug fixes and minor dependency updates.\n\n';
		}
		s += `### Installation\n\n\`\`\`\nnpm i -g appcd@${cleanVersion}\n\`\`\`\n\n`
		s += `### appcd@${cleanVersion}\n\n${changelog}\n\n`;

		for (const pkg of pkgs) {
			const vers = Object.keys(packages[pkg].versions).filter(ver => {
				const { ts } = packages[pkg].versions[ver];
				return !ts || new Date(ts) < dt;
			}).sort(semver.compare);

			for (const v of vers) {
				if (packages[pkg].versions[v].changelog) {
					s += `### ${pkg}@${v}\n\n${packages[pkg].versions[v].changelog}\n\n`;
				}
				delete packages[pkg].versions[v];
			}
		}

		log(`Writing release notes ${cyan(dest)}`);
		fs.writeFileSync(dest, s.trim());
	}
};
