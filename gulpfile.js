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
const Table        = require('cli-table2');
const toposort     = require('toposort');
const util         = require('util');

const isWindows = process.platform === 'win32';

const { parallel, series } = gulp;
const { bold, red, yellow, green, cyan, magenta, gray } = ansiColors;

const cliTableChars = {
	bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
	left: '', 'left-mid': '',
	mid: '', 'mid-mid': '', middle: '',
	right: '', 'right-mid': '',
	top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
};

const dontUpdate = [ 'npm' ];

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

	await upgradeAllPackages();

	runLerna([ 'bootstrap' ]);

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
		.src([
			path.join(__dirname, 'packages/*/gulpfile.js')
		])
		.pipe(debug({ title: 'Linting project:' }))
		.pipe(plumber())
		.pipe(chug({ tasks: [ 'lint' ] }));
});

/*
 * build tasks
 */
const build = exports.build = series(cyclic, async function build() {
	return runLerna([ 'run', '--parallel', 'build' ]);
});

exports.package = series(build, function pkg() {
	return runLerna([ 'run', '--parallel', 'package' ]);
});

/*
 * test tasks
 */
exports.test = series(parallel(nodeInfo, build), function test() {
	return runTests();
});
exports.coverage = series(parallel(nodeInfo, build), function test() {
	return runTests(true);
});

async function runTests(cover) {
	let task = cover ? 'coverage-only' : 'test-only';
	let libCoverage;
	let libReport;
	let reports;
	let coverageDir;
	let mergedCoverageMap;

	if (cover) {
		libCoverage = require('istanbul-lib-coverage');
		libReport = require('istanbul-lib-report');
		reports = require('istanbul-reports');
		coverageDir = path.join(__dirname, 'coverage');
	}

	process.env.SNOOPLOGG = '*';

	const gulp = path.join(path.dirname(require.resolve('gulp')), 'bin', 'gulp.js');
	const gulpfiles = globule.find([ 'packages/*/gulpfile.js' ]);
	const failedProjects = [];

	await gulpfiles
		.reduce((promise, gulpfile) => {
			return promise
				.then(() => new Promise((resolve, reject) => {
					gulpfile = path.resolve(gulpfile);
					const dir = path.dirname(gulpfile);

					log(`Spawning: ${process.execPath} ${gulp} coverage # CWD=${dir}`);
					const child = spawn(process.execPath, [ gulp, task, '--colors' ], { cwd: dir, stdio: [ 'inherit', 'pipe', 'inherit' ] });

					let out = '';
					child.stdout.on('data', data => {
						out += data.toString();
						process.stdout.write(data);
					});

					child.on('close', code => {
						if (!code) {
							log(`Exit code: ${code}`);
							if (cover) {
								for (let coverageFile of globule.find(dir + '/coverage/coverage*.json')) {
									const map = libCoverage.createCoverageMap(JSON.parse(fs.readFileSync(path.resolve(coverageFile), 'utf8')));
									if (mergedCoverageMap) {
										mergedCoverageMap.merge(map);
									} else {
										mergedCoverageMap = map;
									}
								}
							}
						} else if (out.indexOf(`Task '${task}' is not in your gulpfile`) === -1) {
							log(`Exit code: ${code}`);
							failedProjects.push(path.basename(dir));
						} else {
							log(`Exit code: ${code}, no '${task}' task, continuing`);
						}

						resolve();
					});
				}));
		}, Promise.resolve());

	if (cover) {
		fs.removeSync(coverageDir);
		fs.mkdirsSync(coverageDir);
		console.log();

		const ctx = libReport.createContext({
			dir: coverageDir
		});

		const tree = libReport.summarizers.pkg(mergedCoverageMap);
		for (const type of [ 'lcov', 'json', 'text', 'text-summary', 'cobertura' ]) {
			tree.visit(reports.create(type), ctx);
		}
	}

	if (failedProjects.length) {
		if (failedProjects.length === 1) {
			log(red('1 failured project:'));
		} else {
			log(red(`${failedProjects.length} failured projects:`));
		}
		failedProjects.forEach(p => log(red(p)));
		process.exitCode = 1;
	}
}

/*
 * watch/debug tasks
 */
async function startDaemon() {
	spawn(process.execPath, [ 'packages/appcd/bin/appcd', 'start', '--debug', '--config', '{ \"telemetry\": { \"environment\": \"development\" } }' ], { stdio: 'inherit' });
}

function stopDaemon() {
	spawnSync(process.execPath, [ 'packages/appcd/bin/appcd', 'stop' ], { stdio: 'inherit' });
}

exports['start-daemon'] = async () => {
	log('Starting daemon in debug mode');
	console.log('-----------------------------------------------------------');
	startDaemon();
};

async function watchOnly() {
	const binWatcher = gulp
		.watch(`${__dirname}/packages/appcd/bin/*`)
		.on('all', (type, path) => {
			log('Detected change: ' + cyan(path));
			stopDaemon();
			startDaemon();
		});

	const srcWatcher = gulp
		.watch(`${__dirname}/packages/*/src/**/*.js`)
		.on('all', (type, path) => {
			// FIXME: There's almost certainly a better way of doing this than replacing \\ with /
			path = path.replace(/\\/g, '/');
			const m = path.match(new RegExp(`^(${__dirname.replace(/\\/g, '/')}/(packages/([^\/]+)))`));
			if (m) {
				log(`Detected change: ${cyan(path)}`);
				stopDaemon();
				buildDepList(m[2])
					.reduce((promise, dir) => {
						return promise.then(() => new Promise((resolve, reject) => {
							console.log();
							log(cyan('Rebuilding ' + dir));
							gulp
								.src(__dirname + '/' + dir + '/gulpfile.js')
								.pipe(chug({ tasks: [ 'build' ] }))
								.on('finish', () => resolve());
						}));
					}, Promise.resolve())
					.then(startDaemon);
			}
		});

	let stopping = false;

	return new Promise(resolve => {
		process.on('SIGINT', () => {
			if (!stopping) {
				stopping = true;
				binWatcher.close();
				srcWatcher.close();
				resolve();
			}
		});
	});
}
exports['watch-only'] = watchOnly;

exports.watch = series(build, startDaemon, watchOnly);

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

function runYarn(cwd) {
	const packageJsonFile = path.join(cwd, 'package.json');
	const pkgJson = JSON.parse(fs.readFileSync(packageJsonFile));
	let changed = false;

	[ 'dependencies', 'devDependencies', 'optionalDependencies' ].forEach(type => {
		if (pkgJson[type]) {
			for (const dep of Object.keys(pkgJson[type])) {
				if (appcdPackages.has(dep)) {
					delete pkgJson[type][dep];
					changed = true;
				}
			}
		}
	});

	// `yarn check` will complain if the `package.json` contains any `appcd-*` dependencies,
	// we we back up the file and write a `package.json` without them
	if (changed) {
		fs.renameSync(packageJsonFile, packageJsonFile + '.bak');
		fs.writeFileSync(packageJsonFile, JSON.stringify(pkgJson) + '\n');
	}

	const args = Array.prototype.slice.call(arguments, 1);
	if (process.argv.indexOf('--json') !== -1 || process.argv.indexOf('--silent') !== -1) {
		args.push('--no-progress', '--no-emoji');
	}
	return run('yarn', args, { cwd: cwd || process.cwd(), shell: true })
		.then(result => {
			if (changed) {
				fs.renameSync(packageJsonFile + '.bak', packageJsonFile);
			}
			return result;
		})
		.catch(err => {
			if (changed) {
				fs.renameSync(packageJsonFile + '.bak', packageJsonFile);
			}
			throw err;
		});
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

function runNPM(cwd) {
	return run('npm', Array.prototype.slice.call(arguments, 1), { shell: true });
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
						dep.status = (dep.status ? ', ' : '') + 'skipping latest';
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
							dep.status = (dep.status ? ', ' : '') + 'update available';

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
					if (dep.status) {
						dep.status += ', deprecated';
					} else {
						dep.status = 'deprecated';
					}
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

function upgradeAllPackages() {
	const pkgs = {};

	globule
		.find([ './package.json', 'packages/*/package.json' ])
		.forEach(file => {
			const pkgJsonFile = path.resolve(process.cwd(), file);
			const json = JSON.parse(fs.readFileSync(pkgJsonFile));
			pkgs[json.name] = {
				file,
				json
			};
		});

	return Object
		.keys(pkgs)
		.sort()
		.reduce((promise, name) => {
			const pkg = pkgs[name];
			const newPkgJson = {
				name: pkg.json.name
			};
			if (pkg.json.dependencies) {
				newPkgJson.dependencies = {};
				for (const [ name, ver ] of Object.entries(pkg.json.dependencies)) {
					if (!pkgs[name]) {
						newPkgJson.dependencies[name] = ver;
					}
				}
			};
			if (pkg.json.devDependencies) {
				newPkgJson.devDependencies = {};
				for (const [ name, ver ] of Object.entries(pkg.json.devDependencies)) {
					if (!pkgs[name]) {
						newPkgJson.devDependencies[name] = ver;
					}
				}
			};

			fs.writeFileSync(pkg.file, JSON.stringify(newPkgJson, null, '  ') + '\n');

			return promise
				.then(() => run('yarn', [ 'upgrade' ], { cwd: path.dirname(pkg.file), shell: true }))
				.catch(err => {
					fs.writeFileSync(pkg.file, JSON.stringify(pkg.json, null, '  ') + '\n');
					throw err;
				})
				.then(() => {
					fs.writeFileSync(pkg.file, JSON.stringify(pkg.json, null, '  ') + '\n');
				});
		}, Promise.resolve());
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

function exists(file) {
	try {
		if (fs.statSync(file)) {
			return true;
		}
	} catch (e) {}
	return false;
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

function dump() {
	for (var i = 0; i < arguments.length; i++) {
		console.error(util.inspect(arguments[i], false, null, true));
	}
}

exports['deps-changelog'] = async function depChangelog() {
	const depmap = getDepMap(true);
	const npm = require('npm');

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
