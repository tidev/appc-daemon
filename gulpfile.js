'use strict';

// dependency mappings used to wiring up yarn links and build order
const chug         = require('gulp-chug');
const debug        = require('gulp-debug');
const del          = require('del');
const fs           = require('fs-extra');
const globule      = require('globule');
const gulp         = require('gulp');
const gutil        = require('gulp-util');
const istanbul     = require('istanbul');
const npm          = require('npm');
const nspAPI       = require('nsp/lib/api');
const PassThrough  = require('stream').PassThrough;
const path         = require('path');
const plumber      = require('gulp-plumber');
const progress     = require('progress');
const promiseLimit = require('promise-limit');
const runSequence  = require('run-sequence');
const semver       = require('semver');
const spawn        = require('child_process').spawn;
const spawnSync    = require('child_process').spawnSync;
const Table        = require('cli-table2');
const treePrinter  = require('tree-printer');
const util         = require('util');

const appcdRE = /^appcd-/;
const isWindows = process.platform === 'win32';

const { bold, red, yellow, green, cyan, magenta, gray } = gutil.colors;

const cliTableChars = {
	bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
	left: '', 'left-mid': '',
	mid: '', 'mid-mid': '', middle: '',
	right: '', 'right-mid': '',
	top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
};

const dontUpdate = [];

process.env.FORCE_COLOR = 1;

if (process.argv.indexOf('--silent') !== -1) {
	// this is exactly what gulp does internally
	gutil.log = function () {};
}

gulp.task('node-info', () => {
	gutil.log(`Node.js ${process.version} (${process.platform})`);
	gutil.log(process.env);
});

/*
 * misc tasks
 */
gulp.task('check', cb => {
	if (process.argv.indexOf('--json') !== -1 && process.argv.indexOf('--silent') === -1) {
		console.error(red('Please rerun using the --silent option'));
		process.exit(1);
	}

	checkPackages()
		.then(results => {
			if (process.argv.indexOf('--json') !== -1) {
				console.log(JSON.stringify(results, null, 2));
			} else {
				renderPackages(results);
			}
			cb();
		})
		.catch(cb);
});

gulp.task('clean', () => {
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
					default:
						if (name.startsWith('gulpfile.tmp.') || name.startsWith('._')) {
							nuke.push(file);
						}
				}
			}
		}
	}(__dirname));

	nuke.push(path.join(__dirname, 'node_modules'));

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
});

gulp.task('stats', () => {
	displayStats({
		stats: computeSloc(),
		testStats: computeSloc('test')
	});
});

gulp.task('upgrade', cb => {
	Promise.resolve()
		.then(() => checkPackages({ skipSecurity: true }))
		.then(results => upgradeDeps(results.packagesToUpdate))
		.then(() => checkPackages({ skipSecurity: true }))
		.then(results => renderPackages(results))
		.then(() => cb(), cb);
});

/*
 * lint tasks
 */
gulp.task('lint', [ 'cyclic' ], () => {
	return gulp
		.src([
			path.join(__dirname, 'packages/*/gulpfile.js'),
			path.join(__dirname, 'plugins/*/gulpfile.js')
		])
		.pipe(debug({ title: 'Linting project:' }))
		.pipe(plumber())
		.pipe(chug({ tasks: [ 'lint' ] }));
});

/*
 * build tasks
 */
gulp.task('build', [ 'cyclic' ], () => {
	runLerna([ 'run', '--parallel', 'build' ]);
});

/*
TODO: This needs some serious fixing.

gulp.task('package', [ 'build' ], cb => {
	const pkgJson = require('./bootstrap/package.json');
	const keepers = [ 'name', 'version', 'description', 'author', 'maintainers', 'license', 'keyword', 'bin', 'preferGlobal', 'dependencies', 'homepage', 'bugs', 'repository' ];

	for (const key of Object.keys(pkgJson)) {
		if (keepers.indexOf(key) === -1) {
			delete pkgJson[key];
		}
	}

	pkgJson.build = {
		gitHash:   spawnSync('git', [ 'log', '--pretty=oneline', '-n', '1', '--no-color' ], { shell: true }).stdout.toString().split(' ')[0],
		hostname:  require('os').hostname(),
		platform:  process.platform,
		timestamp: new Date().toISOString()
	};

	const found = {};

	function copyDeps(deps, file) {
		if (deps) {
			Object.keys(deps).forEach(dep => {
				if (!found[dep]) {
					found[dep] = deps[dep];
				} else if (found[dep] !== deps[dep]) {
					throw new Error('Unable to pack: duplicate dependencies with different versions\n' +
						dep + ' v' + found[dep] + ' already added, but ' + file + ' wants v' + deps[dep]);
				}
			});
		}
	}

	copyDeps(pkgJson.dependencies);
	pkgJson.dependencies = {};
	pkgJson.bundledDependencies = [];

	globule
		.find([
			'packages/     *     /package.json',
			'!packages/appcd-gulp/    *'
		])
		.forEach(file => {
			const json = require(path.resolve(file));
			pkgJson.bundledDependencies.push(json.name);
			pkgJson.dependencies[json.name] = './node_modules/' + json.name;
			copyDeps(json.dependencies, file);
		});

	pkgJson.bundledDependencies.sort();
	Object.keys(found).sort().forEach(dep => pkgJson.dependencies[dep] = found[dep]);

	const distDir = path.join(__dirname, 'dist');
	if (!exists(distDir)) {
		fs.mkdirSync(distDir);
	}

	const outFile = path.join(distDir, pkgJson.name + '-' + pkgJson.version + '.tgz');
	if (exists(outFile)) {
		fs.unlinkSync(outFile);
	}

	gutil.log('Packing ' + outFile);

	const archiver = require('archiver');
	const ignore = require('ignore');

	const output = fs.createWriteStream(outFile);
	const archive = archiver('tar', {
		gzip: true,
		gzipOptions: {
			level: 1
		}
	});

	output.on('close', () => {
		gutil.log(`Wrote ${archive.pointer()} bytes`);
		cb();
	});

	archive.on('error', err => {
		cb(err);
	});

	archive.pipe(output);

	archive.append(JSON.stringify(pkgJson, null, '  '), { name: 'package/package.json' });

	function getFiles(dir, ignoreFiles) {
		const ig = ignore().add('yarn.lock');

		if (ignoreFiles) {
			ig.add(ignoreFiles);
		}

		const ignoreFile = path.join(dir, '.npmignore');
		if (exists(ignoreFile)) {
			ig.add(fs.readFileSync(ignoreFile, 'utf8').split('\n').filter(s => s && s[0] !== '#'));
		}

		const files = {};
		for (const file of globule.find(dir + '/**')) {
			const stat = fs.statSync(file);
			if (stat.isFile()) {
				files[path.relative(dir, file)] = stat.mode;
			}
		}

		const results = {};
		ig.filter(Object.keys(files)).forEach(file => {
			results[file] = files[file];
		});

		return results;
	}

	function pack(dir, relPath, ignoreFiles) {
		const files = getFiles(dir, ignoreFiles);
		for (const file of Object.keys(files)) {
			const dest = `${relPath}/${file}`;
			gutil.log(` + ${dir}/${file} => ${dest}`);
			if (/package\.json$/.test(file)) {
				const pkgJson = JSON.parse(fs.readFileSync(path.join(dir, file)));
				if (/^appcd/.test(pkgJson.name)) {
					delete pkgJson.dependencies;
					delete pkgJson.devDependencies;
					delete pkgJson.bundledDependencies;
					delete pkgJson.optionalDependencies;
					delete pkgJson.appcdDependencies;
					delete pkgJson.scripts;
					archive.append(JSON.stringify(pkgJson, null, '  '), { name: dest });
					continue;
				}
			}
			archive.append(fs.createReadStream(path.join(dir, file)), { name: dest, mode: files[file] });
		}
	}

	pack(path.join(__dirname, 'bootstrap'), 'package', 'package.json');
	pack(path.join(__dirname, 'conf'), 'package/conf');

	globule
		.find([
			'packages/*',
			'!packages/appcd-gulp'
		])
		.filter(dir => fs.statSync(dir).isDirectory())
		.forEach(dir => {
			pack(dir, 'package/node_modules/' + path.basename(dir));
		});

	archive.finalize();
});
*/

/*
 * test tasks
 */
gulp.task('test', [ 'node-info', 'build' ], cb => runTests(false, cb));
gulp.task('coverage', [ 'node-info', 'build' ], cb => runTests(true, cb));

function runTests(cover, cb) {
	let task = cover ? 'coverage-only' : 'test-only';
	let coverageDir;
	let collector;

	if (cover) {
		coverageDir = path.join(__dirname, 'coverage');
		collector = new istanbul.Collector();
	}

	process.env.SNOOPLOGG = '*';

	const gulp = path.join(path.dirname(require.resolve('gulp')), 'bin', 'gulp.js');
	const gulpfiles = globule.find([ 'packages/*/gulpfile.js', 'plugins/*/gulpfile.js' ]);
	const failedProjects = [];

	gulpfiles
		.reduce((promise, gulpfile) => {
			return promise
				.then(() => new Promise((resolve, reject) => {
					gulpfile = path.resolve(gulpfile);
					const dir = path.dirname(gulpfile);

					gutil.log(`Spawning: ${process.execPath} ${gulp} coverage # CWD=${dir}`);
					const child = spawn(process.execPath, [ gulp, task, '--colors' ], { cwd: dir, stdio: [ 'inherit', 'pipe', 'inherit' ] });

					let out = '';
					child.stdout.on('data', data => {
						out += data.toString();
						process.stdout.write(data);
					});

					child.on('close', code => {
						if (!code) {
							gutil.log(`Exit code: ${code}`);
							if (cover) {
								for (let coverageFile of globule.find(dir + '/coverage/coverage*.json')) {
									collector.add(JSON.parse(fs.readFileSync(path.resolve(coverageFile), 'utf8')));
								}
							}
						} else if (out.indexOf(`Task '${task}' is not in your gulpfile`) === -1) {
							gutil.log(`Exit code: ${code}`);
							failedProjects.push(path.basename(dir));
						} else {
							gutil.log(`Exit code: ${code}, no '${task}' task, continuing`);
						}

						resolve();
					});
				}));
		}, Promise.resolve())
		.then(() => {
			if (cover) {
				del.sync([ coverageDir ]);
				fs.mkdirsSync(coverageDir);
				console.log();

				for (const type of [ 'lcov', 'json', 'text', 'text-summary', 'cobertura' ]) {
					istanbul.Report
						.create(type, { dir: coverageDir })
						.writeReport(collector, true);
				}
			}

			if (!failedProjects.length) {
				return cb();
			}

			if (failedProjects.length === 1) {
				gutil.log(red('1 failured project:'));
			} else {
				gutil.log(red(`${failedProjects.length} failured projects:`));
			}
			failedProjects.forEach(p => gutil.log(red(p)));
			process.exit(1);
		})
		.catch(cb);
}

/*
 * watch/debug tasks
 */
function startDaemon() {
	spawn(process.execPath, [ 'packages/appcd/bin/appcd', 'start', '--debug' ], { stdio: 'inherit' });
}

function stopDaemon() {
	spawnSync(process.execPath, [ 'packages/appcd/bin/appcd', 'stop' ], { stdio: 'inherit' });
}

gulp.task('start-daemon', () => {
	gutil.log('Starting daemon in debug mode');
	console.log('-----------------------------------------------------------');
	startDaemon();
});

gulp.task('watch-only', cb => {
	const watchers = [
		gulp.watch(__dirname + '/packages/*/src/**/*.js', evt => {
			// FIXME: There's almost certainly a better way of doing this than replacing \\ with /
			evt.path = evt.path.replace(/\\/g, '/');
			const m = evt.path.match(new RegExp('^(' +  __dirname.replace(/\\/g, '/') + '/(packages/([^\/]+)))'));
			if (m) {
				gutil.log('Detected change: ' + cyan(evt.path));
				stopDaemon();
				buildDepList(m[2])
					.reduce((promise, dir) => {
						return promise.then(() => new Promise((resolve, reject) => {
							console.log();
							gutil.log(cyan('Rebuilding ' + dir));
							gulp
								.src(__dirname + '/' + dir + '/gulpfile.js')
								.pipe(chug({ tasks: [ 'build' ] }))
								.on('finish', () => resolve());
						}));
					}, Promise.resolve())
					.then(startDaemon);
			}
		}),

		gulp.watch(__dirname + '/plugins/*/src/**/*.js', evt => {
			let p = path.dirname(evt.path);
			while (true) {
				try {
					let pkgJson = JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf-8'));
					if (pkgJson['appcd-plugin'] && pkgJson['appcd-plugin'].type === 'internal') {
						stopDaemon();
						runSequence('build-plugins', startDaemon);
					} else {
						const args = [
							'run',
							'--scope', path.basename(p),
							'build'
						];

						runLerna(args);
					}
					break;
				} catch (e) {
					const q = path.dirname(p);
					if (p === q) {
						break;
					}
					p = q;
				}
			}
		})
	];

	let stopping = false;

	process.on('SIGINT', () => {
		if (!stopping) {
			stopping = true;
			for (const w of watchers) {
				w._watcher.close();
			}
			cb();
		}
	});
});

gulp.task('watch', cb => runSequence('build', 'start-daemon', 'watch-only', cb));

gulp.task('default', () => {
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
	table.push([ cyan('cyclic'),           'detects cyclic dependencies (which are bad) in appcd packages and plugins' ]);
	table.push([ cyan('stats'),            'displays stats about the code' ]);
	// table.push([ cyan('package'),          'builds and packages an appc daemon distribution archive' ]);
	table.push([ cyan('upgrade'),          'detects latest npm deps, updates package.json, and runs upgrade' ]);

	console.log(table.toString() + '\n');
});

/*
 * helper functions
 */

function buildDepList(pkg) {
	const depmap = getDepMap();
	const list = [ pkg ];
	const paths = {};

	(function scan(pkg) {
		for (const dir of Object.keys(depmap)) {
			if (depmap[dir].indexOf(pkg) !== -1) {
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

gulp.task('cyclic', () => {
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
});

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

		for (const dep of packages[name]) {
			test(dep, trail);
		}

		trail.pop();
	}

	for (const name of Object.keys(packages)) {
		test(name);
	}

	return cyclicCache = cyclic;
}

function run(cmd, args, opts) {
	return new Promise((resolve, reject) => {
		opts || (opts = {});
		opts.cwd || (opts.cwd = process.cwd());
		if (!opts.quiet) {
			gutil.log('Running: CWD=' + opts.cwd, cmd, args.join(' '));
		}
		const child = spawn(cmd, args, opts);
		let out = '';
		let err = '';
		child.stdout.on('data', data => out += data.toString());
		child.stderr.on('data', data => err += data.toString());
		child.on('close', code => {
			resolve({
				status: code,
				stdout: out,
				stderr: err
			});
		});
	});
}

function runYarn(cwd) {
	const packageJsonFile = path.join(cwd, 'package.json');
	const pkgJson = JSON.parse(fs.readFileSync(packageJsonFile));
	let changed = false;

	[ 'dependencies', 'devDependencies', 'optionalDependencies' ].forEach(type => {
		if (pkgJson[type]) {
			for (const dep of Object.keys(pkgJson[type])) {
				if (appcdRE.test(dep)) {
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
		fs.writeFileSync(packageJsonFile, JSON.stringify(pkgJson));
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
	gutil.log(`Running ${execPath} ${args.join(' ')}`);
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

	gutil.log('Checking packages...');

	for (let file of globule.find([ './package.json', 'packages/*/package.json', 'plugins/*/package.json' ])) {
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

		if (!skipSecurity) {
			tasks.push([ 'retire', packagePath ]);
		}

		for (const type of [ 'dependencies', 'devDependencies', 'optionalDependencies' ]) {
			if (pkgJson[type]) {
				info[type] = {};

				for (const [ dep, required ] of Object.entries(pkgJson[type])) {
					// figure out if the depenency is installed and what version
					let installed = false;
					try {
						let depModulePath = path.join(packagePath, 'node_modules', dep);
						if (!fs.existsSync(path.join(depModulePath, 'package.json'))) {
							let last = null;
							depModulePath = require.resolve(dep, { paths: [ path.join(packagePath, 'node_modules') ] });
							while (depModulePath !== last && !fs.existsSync(path.join(depModulePath, 'package.json'))) {
								last = depModulePath;
								depModulePath = path.dirname(depModulePath);
							}
						}
						const depPkgJson = JSON.parse(fs.readFileSync(path.join(depModulePath, 'package.json')));
						installed = depPkgJson.version;
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
						if (!skipSecurity) {
							tasks.push([ 'nsp', dep, version ]);
						}
					}

					// check if the dependency is an appcd-* dependency
					if (appcdRE.test(dep)) {
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

	gutil.log(`Found ${cyan(Object.keys(packages).length)} packages`);
	gutil.log(`Found ${cyan(Object.keys(dependencies).length)} dependencies`);
	gutil.log(`Processing ${cyan(totalTasks)} tasks`);

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

	const nspConf = {
		baseUrl: 'https://api.nodesecurity.io'
	};

	await new Promise((resolve, reject) => {
		npm.load({
			silent: true
		}, err => {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});

	const limit = promiseLimit(20);

	await Promise.all(tasks.map(task => limit(async () => {
		const action = task[0];
		const dir = task[1];
		const pkg = task[1];
		const version = task[2];

		// gutil.log(`Running task ${taskCounter++}/${totalTasks}: ${action} ${pkg}${version ? `@${version}` : ''}`);

		switch (action) {
			case 'nsp':
				return new nspAPI(nspConf)
					.check({}, {
						package: {
							name: `check-${pkg}-${Date.now()}`,
							version: '0.0.0',
							dependencies: {
								[pkg]: version
							}
						}
					})
					.then(({ data }) => {
						for (const issue of data) {
							issue.nsp = true;
							dependencies[pkg].versions[version].push(issue);
						}
						bar.tick();
					})
					.catch(err => {
						gutil.log(yellow(`nsp failed for ${pkg}@${version}: ${err.message}`));
						bar.tick();
					});

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
					args.unshift(path.join(__dirname, 'node_modules', '.bin', 'retire'))
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
							gutil.log(result.stderr);
						}

						bar.tick();
						resolve();
					}));
				break;

			case 'npm info':
				return new Promise(resolve => {
					npm.commands.view([ pkg ], true, (err, info) => {
						if (err) {
							gutil.log(yellow(`npm view failed for ${pkg}@${version}: ${err.message}`));
						} else {
							const latest = Object.keys(info)[0];
							const next = info[latest]['dist-tags'] && info[latest]['dist-tags'].next || null;
							dependencies[pkg].latest          = latest;
							dependencies[pkg].latestTimestamp = info[latest].time[latest] || null;
							dependencies[pkg].next            = next;
							dependencies[pkg].nextTimestamp   = next && info[latest].time[next] || null;
							dependencies[pkg].deprecated      = info[latest].deprecated;
						}

						bar.tick();
						resolve();
					});
				});
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
		packagesToUpdate:         [],
		stats:                    computeSloc(),
		testStats:                computeSloc('test')
	};

	gutil.log('Processing packages...');

	for (const [ packageName, dependency ] of Object.entries(dependencies)) {
		if (dependency.deprecated) {
			results.deprecated++;
		}

		for (const issues of Object.values(dependency.versions)) {
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
						if (installed && semver.lt(installed, latest)) {
							dep.status = (dep.status ? ', ' : '') + 'out-of-date';

							const m = required.match(/^(\^|~|>|>=)/);
							results.packagesToUpdate.push({
								path: key,
								name,
								current: required,
								latest: (m ? m[1] : '') + latest,
								latestTimestamp,
								next: next ? `^${next}` : null,
								nextTimestamp
							});
						} else if (!installed && semver.lt(required.replace(cleanVersionRegExp, ''), latest)) {
							dep.status = (dep.status ? ', ' : '') + 'update available';

							const m = required.match(/^(\^|~|>|>=)/);
							results.packagesToUpdate.push({
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
					const { latest, next } = dependencies[name]
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
			for (const issue of pkg.securityIssues) {
				console.log(JSON.stringify(issue));
				// for (const ver of Object.keys(pkg.nodeSecurityIssues[name])) {
				// 	const info = pkg.nodeSecurityIssues[name][ver];
				// 	const tools = [];
				// 	if (info.nsp) {
				// 		tools.push('nsp');
				// 	}
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
		results.packagesToUpdate.length > 0 ? red(results.packagesToUpdate.length) : green(results.packagesToUpdate.length)
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

	if (results.packagesToUpdate.length) {
		console.log(magenta('Recommendations') + '\n');

		if (results.packagesToUpdate.length) {
			console.log(`Run ${cyan('gulp upgrade')} to update:`);
			table = new Table({
				chars: cliTableChars,
				head: [ 'Component', 'Package', 'From', 'To' ],
				style: {
					head: [ 'bold', 'gray' ],
					border: []
				}
			});
			for (const pkg of results.packagesToUpdate) {
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
	}

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

function upgradeDeps(list) {
	if (!list.length) {
		gutil.log('Everything looks good to go, nothing to upgrade');
		return;
	}

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
			gutil.log(red(`Unable to locate ${pkgJsonFile}`));
			continue;
		}

		let pkgJson;
		try {
			pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile));
		} catch (e) {
			gutil.log(red(`Unable to locate ${pkgJsonFile}`));
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

		fs.writeFileSync(pkgJsonFile, JSON.stringify(pkgJson, null, 2));
	}

	runLerna([ 'bootstrap' ]);
}

function computeSloc(type) {
	const srcDirs = [];
	const sloc = require('sloc');
	const supported = sloc.extensions;
	const counters = { total: 0, source: 0, comment: 0, single: 0, block: 0, mixed: 0, empty: 0, todo: 0, files: 0 };

	globule
		.find([ 'packages/*/package.json', 'plugins/*/package.json' ])
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

function getDepMap() {
	if (depmapCache) {
		return depmapCache;
	}

	depmapCache = {};

	globule
		.find([ 'packages/*/package.json', 'plugins/*/package.json' ])
		.forEach(pkgJsonFile => {
			const pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile));
			const name = pkgJson.name;
			depmapCache[name] = [];

			if (pkgJson.dependencies) {
				for (const dep of Object.keys(pkgJson.dependencies)) {
					if (appcdRE.test(dep)) {
						depmapCache[name].push(dep);
					}
				}
			}

			if (pkgJson.devDependencies) {
				for (const dep of Object.keys(pkgJson.devDependencies)) {
					if (appcdRE.test(dep)) {
						depmapCache[name].push(dep);
					}
				}
			}
		});

	return depmapCache;
}

function dump() {
	for (var i = 0; i < arguments.length; i++) {
		console.error(util.inspect(arguments[i], false, null, true));
	}
}
