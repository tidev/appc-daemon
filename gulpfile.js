'use strict';

// dependency mappings used to wiring up yarn links and build order
const chug         = require('gulp-chug');
const david        = require('david');
const debug        = require('gulp-debug');
const del          = require('del');
const fs           = require('fs-extra');
const globule      = require('globule');
const gulp         = require('gulp');
const gutil        = require('gulp-util');
const istanbul     = require('istanbul');
const Nsp          = require('nsp');
const PassThrough  = require('stream').PassThrough;
const path         = require('path');
const plumber      = require('gulp-plumber');
const promiseLimit = require('promise-limit');
const runSequence  = require('run-sequence');
const semver       = require('semver');
const spawn        = require('child_process').spawn;
const spawnSync    = require('child_process').spawnSync;
const Table        = require('cli-table2');
const treePrinter  = require('tree-printer');
const util         = require('util');

const appcdRE = /^appcd-/;

const cliTableChars = {
	bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
	left: '', 'left-mid': '',
	mid: '', 'mid-mid': '', middle: '',
	right: '', 'right-mid': '',
	top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
};

const fixReasons = {
	install: 'install missing packages',
	link: 'link missing dependencies',
	nuke: 'nuke and reinstall'
};

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
		console.error(gutil.colors.red('Please rerun using the --silent option'));
		process.exit(1);
	}

	Promise.resolve()
		.then(() => checkPackages())
		.then(results => {
			if (process.argv.indexOf('--json') !== -1) {
				console.log(JSON.stringify(results, null, 2));
			} else {
				renderPackages(results);
			}
		})
		.then(() => cb())
		.catch(cb);
});

gulp.task('fix', cb => {
	Promise.resolve()
		.then(() => checkPackages())
		.then(results => {
			if (!Object.keys(results.needsFixing).length) {
				gutil.log('Everything looks good to go, nothing to fix');
				return;
			}

			const nuke = [];

			const table = new Table({
				chars: cliTableChars,
				head: [ 'Component', 'Action' ],
				style: {
					head: [ 'bold', 'gray' ],
					border: []
				}
			});
			for (const pkg of Object.keys(results.needsFixing)) {
				const rel = path.relative(__dirname, pkg) || path.basename(pkg);
				table.push([rel, fixReasons[results.needsFixing[pkg]] || 'unknown']);
				if (results.needsFixing[pkg]) {
					nuke.push(pkg);
				}
			}
			console.log('\n' + table.toString() + '\n');

			if (nuke.indexOf(__dirname) !== -1) {
				gutil.log(gutil.colors.red('You must manually `rm -rf node_modules && yarn`'));
				process.exit(1);
			}

			for (const pkg of nuke) {
				const p = `${pkg}/node_modules`;
				gutil.log(`Deleting ${p}`);
				fs.removeSync(p);
			}

			spawnSync(process.execPath, [
				'./node_modules/.bin/lerna',
				'bootstrap'
			], { stdio: 'inherit' });

			return nuke.reduce((promise, cwd) => {
				return promise
					.then(() => runYarn(cwd))
					.then(result => {
						if (result.status) {
							gutil.log();
							gutil.log(gutil.colors.red(`Failed to install deps for ${cwd}`));
							gutil.log();
							result.stderr.toString().trim().split('\n').forEach(line => gutil.log(gutil.colors.red(line)));
							gutil.log();
						}
					});
			}, Promise.resolve());
		})
		.then(() => checkPackages())
		.then(results => {
			if (process.argv.indexOf('--json') !== -1) {
				console.log(JSON.stringify(results, null, 2));
			} else {
				renderPackages(results);
			}
		})
		.then(() => cb())
		.catch(cb);
});

gulp.task('stats', () => {
	displayStats({
		stats: computeSloc(),
		testStats: computeSloc('test')
	});
});

gulp.task('upgrade', cb => {
	Promise.resolve()
		.then(() => checkPackages())
		.then(results => upgradeDeps(results.packagesToUpdate))
		.then(() => checkPackages())
		.then(results => renderPackages(results))
		.then(() => cb(), cb);
});

/*
 * lint tasks
 */
gulp.task('lint', () => {
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
gulp.task('build', () => {
	spawnSync(process.execPath, [
		'./node_modules/.bin/lerna',
		'run',
		'--parallel',
		'build'
	], { stdio: 'inherit' });
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
				gutil.log(gutil.colors.red('1 failured project:'));
			} else {
				gutil.log(gutil.colors.red(`${failedProjects.length} failured projects:`));
			}
			failedProjects.forEach(p => gutil.log(gutil.colors.red(p)));
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
			const m = evt.path.match(new RegExp('^(' + __dirname + '/(packages/([^\/]+)))'));
			if (m) {
				gutil.log('Detected change: ' + gutil.colors.cyan(evt.path));
				stopDaemon();
				buildDepList(m[2])
					.reduce((promise, dir) => {
						return promise.then(() => new Promise((resolve, reject) => {
							console.log();
							gutil.log(gutil.colors.cyan('Rebuilding ' + dir));
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
							'./node_modules/.bin/lerna',
							'run',
							'--scope', path.basename(p),
							'build'
						];
						gutil.log(`Running: ${process.execPath} ${args.join(' ')}`);
						spawnSync(process.execPath, args, { stdio: 'inherit' });
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
	const cyan = gutil.colors.cyan;
	console.log('\nAvailable tasks:');
	const table = new Table({
		chars: cliTableChars,
		head: [],
		style: {
			head: [ 'bold' ],
			border: []
		}
	});

	table.push([cyan('build'),            'performs a full build']);
	table.push([cyan('watch'),            'builds all packages, then starts watching them']);
	table.push([cyan('watch-only'),       'starts watching all packages to perform build']);
	table.push([cyan('check'),            'checks missing/outdated dependencies/link, security issues, and code stats']);
	table.push([cyan('fix'),              'fixes any missing dependencies or links']);
	table.push([cyan('stats'),            'displays stats about the code']);
	// table.push([cyan('package'),          'builds and packages an appc daemon distribution archive']);
	table.push([cyan('ugprade'),          'detects latest npm deps, updates package.json, and runs upgrade']);

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

function run(cmd, args, opts) {
	return new Promise((resolve, reject) => {
		opts || (opts = {});
		opts.cwd || (opts.cwd = process.cwd());
		gutil.log('Running: CWD=' + opts.cwd, cmd, args.join(' '));
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

function runNPM(cwd) {
	return run('npm', Array.prototype.slice.call(arguments, 1), { shell: true });
}

function runDavid(pkgJson, type, dest) {
	return new Promise((resolve, reject) => {
		if (!pkgJson[type]) {
			return resolve();
		}

		david.getDependencies({
			name: pkgJson.name,
			dependencies: pkgJson[type]
		}, { npm: { progress: false } }, (err, deps) => {
			if (err) {
				gutil.log(gutil.colors.red('David failed! ' + (err.message || err.toString())));
			} else {
				for (const dep of Object.keys(deps)) {
					for (const key of Object.keys(deps[dep])) {
						dest[type][dep][key] = deps[dep][key];
					}
				}
			}
			resolve();
		});
	});
}

function checkPackages() {
	const packages = {};
	const deprecatedMap = {};
	const limit = promiseLimit(4);

	gutil.log('Checking packages...');

	return Promise
		.all(globule.find([ './package.json', 'packages/*/package.json', 'plugins/*/package.json' ]).map(packageJsonFile => new Promise((resolve, reject) => {
			packageJsonFile = path.resolve(packageJsonFile);
			fs.readFile(packageJsonFile, (err, contents) => {
				if (err) {
					gutil.log('ERROR:', err);
					return resolve();
				}

				let pkgJson;
				try {
					pkgJson = JSON.parse(contents);
				} catch (err) {
					gutil.log(gutil.colors.red(err));
					return resolve();
				}

				const packagePath = path.dirname(packageJsonFile);
				packages[packagePath] = {
					name: pkgJson.name,
					path: packagePath,
					packageJson: packageJsonFile,
					nodeSecurityIssues: {},
					yarnIssues: [],
					deprecated: {},
					dependencies: {},
					devDependencies: {},
					optionalDependencies: {}
				};

				[ 'dependencies', 'devDependencies', 'optionalDependencies' ].forEach(type => {
					if (pkgJson[type]) {
						packages[packagePath][type] = {};
						for (const dep of Object.keys(pkgJson[type])) {
							let installed = false;
							try {
								const depPkgJson = JSON.parse(fs.readFileSync(path.join(packagePath, 'node_modules', dep, 'package.json')));
								installed = depPkgJson.version;
							} catch (e) {}

							deprecatedMap[dep] = null;

							packages[packagePath][type][dep] = {
								installed: installed,
								required: pkgJson[type][dep],
								deprecated: false
							};
						}
					}
				});

				Promise
					.all([
						new Promise(resolve => {
							Nsp.check({
								package: pkgJson
							}, (err, results) => {
								if (err) {
									guilt.log('NSP failed!', err);
									return resolve();
								}

								for (const data of results) {
									const ver = data.version;
									let n = packages[packagePath].nodeSecurityIssues[data.module];
									if (!n) {
										n = packages[packagePath].nodeSecurityIssues[data.module] = {};
									}
									if (!n[ver]) {
										n[ver] = {
											vulnerabilities: {},
											paths:           {}
										};
									}
									n[ver].nsp = true;

									if (!n[ver].vulnerabilities[data.advisory]) {
										n[ver].vulnerabilities[data.advisory] = {};
									}

									Object.assign(n[ver].vulnerabilities[data.advisory], {
										title:               data.title,
										vulnerable_versions: data.vulnerable_versions,
										patched_versions:    data.patched_versions,
										publish_date:        data.publish_date,
										updated_at:          data.updated_at
									});

									n[ver].paths[data.path.join(' > ')] = data.path;
								}

								resolve();
							});
						}),

						limit(() => {
							return run(process.execPath, [
								path.join(__dirname, 'node_modules', '.bin', 'retire'),
								'--node',
								'--package',
								'--outputformat', 'json',
								'--outputpath', 'retire_output.json'
							], { cwd: packagePath })
								.then(result => new Promise(resolve => {
									const outFile = path.join(packagePath, 'retire_output.json')

									if (result.status !== 13) {
										fs.unlinkSync(outFile);
										if (result.status !== 0) {
											gutil.log(result.stderr);
										}
										return resolve();
									}

									fs.readFile(outFile, (err, contents) => {
										if (err) {
											guilt.log('Retire failed!', err);
											return resolve();
										}

										fs.unlinkSync(outFile);

										const issues = JSON.parse(contents);
										for (const issue of issues) {
											for (const result of issue.results) {
												const ver = result.version;
												const path = [];
												(function walk(n) {
													if (n.parent) {
														walk(n.parent);
													}
													path.push(`${n.component}@${n.version}`);
												}(result));

												if (path.length === 1 || !appcdRE.test(path[1])) {
													let n = packages[packagePath].nodeSecurityIssues[result.component];
													if (!n) {
														n = packages[packagePath].nodeSecurityIssues[result.component] = {};
													}

													if (!n[ver]) {
														n[ver] = {
															vulnerabilities: {},
															paths:           {}
														};
													}

													for (const v of result.vulnerabilities) {
														const advisory = v.info && v.info[0];
														if (advisory && !n[ver].vulnerabilities[advisory]) {
															n[ver].vulnerabilities[advisory] = {
																title: v.identifiers.summary
															};
														}
													}

													n[ver].retire = true;
													n[ver].paths[path.join(' > ')] = path;
												}
											}
										}

										resolve();
									});
								}));
						}),

						runDavid(pkgJson, 'dependencies', packages[packagePath]),
						runDavid(pkgJson, 'devDependencies', packages[packagePath]),
						runDavid(pkgJson, 'optionalDependencies', packages[packagePath]),

						runYarn(packagePath, 'check', '--json')
							.then(result => {
								if (result.status) {
									const lines = result.stderr.toString().trim().split('\n');
									for (let line of lines) {
										try {
											line = JSON.parse(line);
											if (line.type === 'error' && !/^Found \d+ errors\.$/.test(line.data)) {
												packages[packagePath].yarnIssues.push(line.data);
											}
										} catch (e) {}
									}
								}
							})
					])
					.then(resolve, reject);
			});
		})))
		.then(() => {
			// now that we have a list of all unique dependencies, we need to
			// call `npm info` for each and see if the module is deprecated
			const deps = Object.keys(deprecatedMap).sort();
			gutil.log('Checking deprecations...');
			return Promise
				.all(deps.map(dep => {
					if (deprecatedMap[dep] === null && !appcdRE.test(dep)) {
						return runNPM(null, 'info', dep, '--json')
							.then(result => {
								if (!result.status) {
									try {
										const info = JSON.parse(result.stdout);
										deprecatedMap[dep] = info.deprecated || false;
									} catch (e) {}
								}
							});
					}
				}))
				.then(() => {
					// update the package information object
					gutil.log('Updating package table...')
					for (const packagePath of Object.keys(packages)) {
						for (const type of [ 'dependencies', 'devDependencies', 'optionalDependencies' ]) {
							if (packages[packagePath][type]) {
								for (const dep of Object.keys(packages[packagePath][type])) {
									if (deprecatedMap[dep]) {
										packages[packagePath].deprecated[dep] = deprecatedMap[dep];
										packages[packagePath][type][dep].deprecated = deprecatedMap[dep];
									}
								}
							}
						}
					}
				});
		})
		.then(() => processPackages(packages));
}

function processPackages(packages) {
	const results = {
		packages: packages,
		missingDeps: 0,
		missingLinks: 0,
		needsFixing: {},
		securityIssues: 0,
		dependencySecurityIssues: 0,
		yarnIssues: 0,
		deprecated: 0,
		packagesToUpdate: [],
		stats: computeSloc(),
		testStats: computeSloc('test')
	};
	const depmap = getDepMap();

	gutil.log('Processing packages...');

	for (const key of Object.keys(packages)) {
		const pkg = packages[key];

		results.dependencySecurityIssues += Object.keys(pkg.nodeSecurityIssues).length;

		// check yarn issues
		for (const issue of pkg.yarnIssues) {
			// note: we don't do anything for wrong versions of deps because
			// even running `yarn install` again doesn't fix it
			if (/Lockfile does not contain pattern/i.test(issue)) {
				results.needsFixing[key] = 'nuke';
			} else if (/not installed/.test(issue) && results.needsFixing[key] !== 'nuke') {
				results.needsFixing[key] = 'install';
			}
		}

		results.deprecated += Object.keys(pkg.deprecated).length;

		// check yarn links
		if (!results.needsFixing[key]) {
			const rel = path.relative(__dirname, key);
			if (depmap[rel]) {
				for (const link of depmap[rel]) {
					try {
						if (!fs.lstatSync(path.join(key, 'node_modules', path.basename(link))).isSymbolicLink()) {
							throw new Error('bad link');
						}
					} catch (e) {
						results.missingLinks++;
						if (!results.needsFixing[key]) {
							results.needsFixing[key] = 'link';
						}
						break;
					}
				}
			}
		}

		[ 'dependencies', 'devDependencies', 'optionalDependencies' ].forEach(type => {
			if (pkg[type] && Object.keys(pkg[type]).length) {
				for (const name of Object.keys(pkg[type])) {
					const dep = pkg[type][name];

					if (!dep.installed) {
						results.missingDeps++;
						if (!dep.status) {
							dep.status = 'not installed';
						}
					} else if (pkg.nodeSecurityIssues[name] && Object.keys(pkg.nodeSecurityIssues[name]).some(ver => semver.eq(ver, dep.installed))) {
						results.securityIssues++;
						dep.status = 'security vulnerability';
					}

					if (dep.required !== 'latest' && dep.required !== 'next' && dep.required !== '*') {
						const range = dep.installed ? `<=${dep.installed}` : (semver.validRange(dep.required) || '');
						const version = dep.stable || dep.latest;
						if (version && range && !semver.satisfies(version, range)) {
							const m = dep.required.match(/^(\^|~|>|>=)/);
							results.packagesToUpdate.push({
								path: key,
								name: name,
								current: dep.required,
								updated: (m ? m[1] : '') + dep.stable
							});
							if (!dep.status) {
								dep.status = 'out-of-date';
							}
						}
					}

					if (dep.deprecated) {
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
		});

		results.yarnIssues += pkg.yarnIssues.length;
	}

	results.dependencySecurityIssues -= results.securityIssues;

	return results;
}

function renderPackages(results) {
	console.log();

	const packages = results.packages;

	const bold    = gutil.colors.bold;
	const cyan    = gutil.colors.cyan;
	const gray    = gutil.colors.gray;
	const green   = gutil.colors.green;
	const magenta = gutil.colors.magenta;
	const red     = gutil.colors.red;
	const yellow  = gutil.colors.yellow;

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
			head: [ 'Name', 'Required', 'Installed', 'Stable', 'Latest', 'Status' ],
			style: {
				head: [ 'bold' ],
				border: []
			}
		});

		[ 'dependencies', 'devDependencies', 'optionalDependencies' ].forEach(type => {
			if (pkg[type] && Object.keys(pkg[type]).length) {
				table.push([{ colSpan: 6, content: gray(typeLabels[type]) }]);

				for (const name of Object.keys(pkg[type])) {
					const dep = pkg[type][name];
					const packageName = '  ' + name;

					if (dep.status === 'ok') {
						table.push([ packageName, dep.required, dep.installed, dep.stable, dep.latest, green(dep.status) ]);
					} else if (dep.status.indexOf('out-of-date') !== -1) {
						table.push([ packageName, dep.required, red(dep.installed), green(dep.stable), dep.latest, red(dep.status) ]);
					} else if (dep.status === 'deprecated') {
						table.push([ packageName, dep.required, dep.installed, dep.stable, dep.latest, red(dep.status) ]);
					} else if (dep.status === 'skipping latest') {
						table.push([ packageName, dep.required, dep.installed, dep.stable, dep.latest, yellow(dep.status) ]);
					} else {
						table.push([ packageName, dep.required, red(dep.installed), dep.stable, dep.latest, red(dep.status) ]);
					}
				}
			}
		});

		console.log(table.toString() + '\n');

		if (Object.keys(pkg.nodeSecurityIssues).length) {
			console.log(gray(' Node Security Issues:'));
			for (const name of Object.keys(pkg.nodeSecurityIssues)) {
				for (const ver of Object.keys(pkg.nodeSecurityIssues[name])) {
					const info = pkg.nodeSecurityIssues[name][ver];
					const tools = [];
					if (info.nsp) {
						tools.push('nsp');
					}
					if (info.retire) {
						tools.push('retire');
					}

					console.log('   • ' + bold(name + '@' + ver) + ' ' + gray('(' + tools.join(', ') + ')'));


					table = new Table({
						chars: cliTableChars,
						head: [ gray('Vulnerability'), gray('Info'), gray('Vulnerable'), gray('Patched'), gray('Published'), gray('Updated') ],
						style: {
							head: [ 'bold' ],
							border: []
						}
					});

					for (const advisory of Object.keys(info.vulnerabilities)) {
						const issue = info.vulnerabilities[advisory];

						table.push([
							red(issue.title),
							advisory,
							issue.vulnerable_versions || 'n/a',
							issue.patched_versions || 'n/a',
							issue.publish_date ? new Date(issue.publish_date).toLocaleDateString() : 'n/a',
							issue.updated_at ? new Date(issue.updated_at).toLocaleDateString() : 'n/a'
						]);

						console.log(table.toString().split('\n').map(s => '    ' + s).join('\n'));
					}

					const tree = [];
					for (const pp of Object.values(info.paths)) {
						let n = tree;
						for (const p of pp) {
							let found = false;
							for (let i = 0; i < n.length; i++) {
								if (n[i].name === p) {
									found = true;
									n = n[i].children;
								}
							}

							if (!found) {
								n.push({
									name: p,
									children: []
								});
							}
						}
					}

					console.log(treePrinter(tree).split('\n').slice(1).map(l => '       ' + l).join('\n'));
				}
			}
		}

		if (pkg.yarnIssues.length) {
			console.log(gray(' Yarn Issues:'));
			for (const err of pkg.yarnIssues) {
				console.log(`   • ${red(err)}`);
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

	displayStats(results);

	console.log(magenta('Summary') + '\n');
	table = new Table({ chars: cliTableChars, head: [], style: { head: [ 'bold' ], border: [] } });
	table.push([
		'Missing dependencies',
		results.missingDeps > 0 ? red(results.missingDeps) : green(results.missingDeps)
	]);
	table.push([
		'Missing links',
		results.missingLinks > 0 ? red(results.missingLinks) : green(results.missingLinks)
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
		'Deep Node Dependency Security Issues',
		results.dependencySecurityIssues > 0 ? red(results.dependencySecurityIssues) : green(results.dependencySecurityIssues)
	]);
	table.push([
		'Yarn Issues',
		results.yarnIssues > 0 ? red(results.yarnIssues) : green(results.yarnIssues)
	]);
	console.log(table.toString() + '\n');

	if (results.packagesToUpdate.length || Object.keys(results.needsFixing).length) {
		console.log(magenta('Recommendations') + '\n');

		if (results.packagesToUpdate.length) {
			console.log(`Run ${cyan('gulp upgrade-all')} to update:`);
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
				table.push([rel, pkg.name, pkg.current, '→', hlVer(pkg.updated, pkg.current)]);
			}
			console.log(table.toString() + '\n');
		}

		if (Object.keys(results.needsFixing).length) {
			console.log(`Run ${cyan('gulp fix')} to fix node_modules:`);
			table = new Table({
				chars: cliTableChars,
				head: [ 'Component', 'Action' ],
				style: {
					head: [ 'bold', 'gray' ],
					border: []
				}
			});
			for (const pkg of Object.keys(results.needsFixing)) {
				const rel = path.relative(__dirname, pkg) || path.basename(pkg);
				table.push([rel, fixReasons[results.needsFixing[pkg]] || 'unknown']);
			}
			console.log(table.toString() + '\n');
		}
	}
}

function displayStats(results) {
	const gray = gutil.colors.gray;
	const green = gutil.colors.green;
	const magenta = gutil.colors.magenta;
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

function hlVer(ver, ref) {
	const green = gutil.colors.green;
	const version = [];
	const m = ver.match(/^([^\d]+)?(.+)$/);
	const to = (m ? m[2] : ver).split('.');
	const from = ref.replace(/[^\.\d]/g, '').split('.');

	while (to.length) {
		if (parseInt(to[0]) > parseInt(from[0])) {
			if (version.length) {
				return (m && m[1] || '') + version.concat(green(to.join('.'))).join('.');
			}
			return green((m && m[1] || '') + to.join('.'));
		}
		version.push(to.shift());
		from.shift();
	}

	return (m && m[1] || '') + version.join('.');
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
		components[pkgJsonFile][pkg.name] = pkg.updated;
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
			gutil.log(gutil.color.red(`Unable to locate ${pkgJsonFile}`));
			continue;
		}

		let pkgJson;
		try {
			pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile));
		} catch (e) {
			gutil.log(gutil.color.red(`Unable to locate ${pkgJsonFile}`));
			continue;
		}

		console.log(gutil.colors.magenta(pkgJsonFile));

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
					table.push([packageName, pkgJson[type][packageName], '→', hlVer(components[pkgJsonFile][packageName], pkgJson[type][packageName])]);
					pkgJson[type][packageName] = components[pkgJsonFile][packageName];
				}
			});
		}

		console.log(table.toString() + '\n');

		fs.writeFileSync(pkgJsonFile, JSON.stringify(pkgJson, null, 2));
	}

	// next run `yarn upgrade`
	return Object.keys(components).reduce((promise, pkgJsonFile) => {
		const cwd = path.dirname(pkgJsonFile);
		return promise
			.then(() => runYarn(cwd, 'upgrade'))
			.then(result => {
				if (result.status) {
					gutil.log();
					gutil.log(gutil.colors.red(`Failed to upgrade deps for ${cwd}`));
					gutil.log();
					result.stderr.toString().trim().split('\n').forEach(line => gutil.log(gutil.colors.red(line)));
					gutil.log();
				}
			});
	}, Promise.resolve());
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
	const n = parseFloat(num)
	if (isNaN(n)) {
		return num;
	}
	const pos = String(Math.abs(n)).split('.');
	const val = pos[0].replace(/./g, function(c, i, a) {
	    return i && c !== "." && ((a.length - i) % 3 === 0) ? ',' + c : c;
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
