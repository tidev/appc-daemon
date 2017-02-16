'use strict';

// dependency mappings used to wiring up yarn links and build order
const chug        = require('gulp-chug');
const david       = require('david');
const debug       = require('gulp-debug');
const del         = require('del');
const depmap      = require('./dependency-map.json');
const fs          = require('fs-extra');
const globule     = require('globule');
const gulp        = require('gulp');
const gutil       = require('gulp-util');
const istanbul    = require('istanbul');
const Nsp         = require('nsp');
const path        = require('path');
const runSequence = require('run-sequence');
const semver      = require('semver');
const spawn       = require('child_process').spawn;
const spawnSync   = require('child_process').spawnSync;
const Table       = require('cli-table2');

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

if (process.argv.indexOf('--silent') !== -1) {
	// this is exactly what gulp does internally
	gutil.log = function () {};
}

/*
 * install tasks
 */
gulp.task('install', cb => runSequence('link', 'install-deps', 'build', cb));

gulp.task('install-deps', cb => {
	globule
		.find(['./*/package.json', 'packages/*/package.json', 'plugins/*/package.json'])
		.reduce((promise, cwd) => {
			cwd = path.dirname(path.resolve(cwd));
			return promise
				.then(() => runYarn(cwd, 'install'))
				.then(result => {
					if (result.status) {
						gutil.log();
						gutil.log(gutil.colors.red(`Failed to install deps for ${cwd}`));
						gutil.log();
						result.stderr.toString().trim().split('\n').forEach(line => gutil.log(gutil.colors.red(line)));
						gutil.log();
					}
				});
		}, Promise.resolve())
		.then(() => cb(), cb);
});

gulp.task('link', cb => {
	linkDeps().then(() => cb(), cb);
});

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
			const install = [];

			const table = new Table({
				chars: cliTableChars,
				head: ['Component', 'Action'],
				style: {
					head: ['bold', 'gray'],
					border: []
				}
			});
			for (const pkg of Object.keys(results.needsFixing)) {
				let rel = path.relative(__dirname, pkg) || path.basename(pkg);
				table.push([rel, fixReasons[results.needsFixing[pkg]] || 'unknown']);
				if (results.needsFixing[pkg] === 'nuke') {
					nuke.push(pkg);
					install.push(pkg);
				} else if (results.needsFixing[pkg] === 'install') {
					install.push(pkg);
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
				del.sync([ p ], { force: true });
			}

			return install.reduce((promise, cwd) => {
				return promise
					.then(() => runYarn(cwd, 'install'))
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
		.then(() => linkDeps())
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

gulp.task('upgrade-all', cb => {
	Promise.resolve()
		.then(() => checkPackages())
		.then(results => upgradeDeps(results.packagesToUpdate))
		.then(() => cb(), cb);
});

gulp.task('upgrade-critical', cb => {
	Promise.resolve()
		.then(() => checkPackages())
		.then(results => upgradeDeps(results.criticalToUpdate))
		.then(() => cb(), cb);
});

/*
 * build tasks
 */
gulp.task('build', cb => runSequence('build-packages', 'build-core', 'build-bootstrap', 'build-plugins', cb));

gulp.task('build-bootstrap', buildTask('bootstrap/gulpfile.js'));

gulp.task('build-core', buildTask('core/gulpfile.js'));

gulp.task('build-packages', buildTask('packages/*/gulpfile.js'));

gulp.task('build-plugins', buildTask('plugins/*/gulpfile.js'));

function buildTask(pattern) {
	return () => gulp
		.src(path.join(__dirname, pattern))
		.pipe(chug({ tasks: ['build'] }));
}

gulp.task('package', ['build'], cb => {
	const pkgJson = {
		name:         '',
		version:      '',
		description:  '',
		author:       '',
		license:      '',
		keywords:     '',
		bin:          {},
		preferGlobal: true,
		dependencies: {},
		build: {
			gitHash:   spawnSync('git', ['log', '--pretty=oneline', '-n', '1', '--no-color']).stdout.toString().split(' ')[0],
			hostname:  require('os').hostname(),
			platform:  process.platform,
			timestamp: new Date().toISOString()
		}
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

	let bootstrap = require('./bootstrap/package.json');
	pkgJson.name = bootstrap.name;
	pkgJson.version = bootstrap.version;
	pkgJson.description = bootstrap.description;
	pkgJson.author = bootstrap.author;
	pkgJson.license = bootstrap.license;
	pkgJson.keywords = bootstrap.keywords;
	bootstrap.bin && Object.keys(bootstrap.bin).forEach(bin => {
		pkgJson.bin[bin] = './' + path.relative(__dirname, path.resolve('./bootstrap', bootstrap.bin[bin]));
	});
	copyDeps(bootstrap.dependencies);

	globule
		.find([
			'./core/package.json',
			'packages/*/package.json',
			'!packages/appcd-gulp/*'
		])
		.forEach(file => {
			const json = require(path.resolve(file));
			copyDeps(json.dependencies, file);
		});

	// globule
	// 	.find(['plugins/*/package.json'])
	// 	.forEach(file => {
	// 		const json = require(path.resolve(file));
	// 		copyDeps(json.dependencies, file);
	// 	});

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

	const licenseFile = path.join(__dirname, 'LICENSE');
	if (exists(licenseFile)) {
		archive.append(fs.createReadStream(licenseFile), { name: 'package/LICENSE' });
	}

	function pack(dir, relPath) {
		const ignoreFile = path.join(dir, '.npmignore');
		const ig = ignore().add('yarn.lock');
		const pkg = path.basename(dir);
		if (exists(ignoreFile)) {
			ig.add(fs.readFileSync(ignoreFile, 'utf8').split('\n').filter(s => s && s[0] !== '#'));
		}
		const files = globule.find(dir + '/**')
			.filter(file => fs.statSync(file).isFile())
			.map(file => path.relative(dir, file));
		ig.filter(files).forEach(file => {
			const dest = `${relPath}/${pkg}/${file}`;
			gutil.log(` + ${pkg}/${file} => ${dest}`);
			archive.append(fs.createReadStream(path.join(dir, file)), { name: dest });
		});
	}

	pack(path.join(__dirname, 'bootstrap'), 'package');

	globule
		.find(['packages/*', '!packages/appcd-gulp'])
		.filter(dir => fs.statSync(dir).isDirectory())
		.forEach(dir => {
			pack(dir, 'package/node_modules');
		});

	archive.finalize();
});

/*
 * test tasks
 */
gulp.task('coverage', () => {
	const coverageDir = path.join(__dirname, 'coverage');
	del.sync([coverageDir]);

	const collector = new istanbul.Collector();
	const gulp = path.join(path.dirname(require.resolve('gulp')), 'bin', 'gulp.js');
	const gulpfiles = globule.find(['./*/gulpfile.js', 'packages/*/gulpfile.js', 'plugins/*/gulpfile.js']);

	for (let gulpfile of gulpfiles) {
		gulpfile = path.resolve(gulpfile);
		const dir = path.dirname(gulpfile);

		gutil.log(`Spawning: ${process.execPath} ${gulp} coverage # CWD=${dir}`);
		const child = spawnSync(process.execPath, [
			gulp,
			'coverage'
		], { cwd: dir, stdio: 'inherit' });
		gutil.log(`Exit code = ${child.status}`);

		if (!child.status) {
			for (let coverageFile of globule.find(dir + '/coverage/coverage*.json')) {
				collector.add(JSON.parse(fs.readFileSync(path.resolve(coverageFile), 'utf8')));
			}
		}
	}

	fs.mkdirsSync(coverageDir);

	for (const type of [ 'lcov', 'json', 'text', 'text-summary' ]) {
		istanbul.Report.create(type, { dir: coverageDir }).writeReport(collector, true);
	}
});

/*
 * watch/debug tasks
 */
gulp.task('build-watch', cb => runSequence('build', 'watch', cb));

gulp.task('watch', cb => {
	console.log('-----------------------------------------------------------');

	const watchers = [
		gulp.watch(__dirname + '/bootstrap/src/**/*.js', () => {
			runSequence('build-bootstrap');
		}),
		gulp.watch(__dirname + '/core/src/**/*.js', () => {
			runSequence('build-core');
		}),
		gulp.watch(__dirname + '/packages/*/src/**/*.js', evt => {
			const m = evt.path.match(new RegExp('^(' + __dirname + '/(packages/([^\/]+)))'));
			if (m) {
				gutil.log('Detected change: ' + gutil.colors.cyan(evt.path));
				buildDepList(m[2]).reduce((promise, dir) => {
					return promise.then(() => new Promise((resolve, reject) => {
						console.log();
						gutil.log(gutil.colors.cyan('Rebuilding ' + dir));
						gulp
							.src(__dirname + '/' + dir + '/gulpfile.js')
							.pipe(chug({ tasks: ['build'] }))
							.on('finish', resolve);
					}));
				}, Promise.resolve());
			}
		}),
		gulp.watch(__dirname + '/plugins/*/src/**/*.js', () => {
			runSequence('build-plugins');
		})
	];

	process.on('SIGINT', () => {
		for (const w of watchers) {
			w._watcher.close();
		}
		cb();
	});
});

gulp.task('default', () => {
	const cyan = gutil.colors.cyan;
	console.log('\nAvailable tasks:');
	const table = new Table({
		chars: cliTableChars,
		head: [],
		style: {
			head: ['bold'],
			border: []
		}
	});

	table.push([cyan('build'),            'performs a full build']);
	table.push([cyan('build-bootstrap'),  'builds only the bootstrap']);
	table.push([cyan('build-core'),       'builds only the core']);
	table.push([cyan('build-packages'),   'builds all packages']);
	table.push([cyan('build-plugins'),    'builds all plugins']);
	table.push([cyan('build-watch'),      'builds all packages, then starts watching them']);
	table.push([cyan('check'),            'checks missing/outdated dependencies/link, security issues, and code stats']);
	table.push([cyan('fix'),              'fixes any missing dependencies or links']);
	table.push([cyan('install'),          'links/installs dependencies, then does a full build']);
	table.push([cyan('install-deps'),     'installs each package\'s npm dependencies']);
	table.push([cyan('link'),             'ensures all links are wired up']);
	table.push([cyan('package'),          'builds and packages an appc daemon distribution archive']);
	table.push([cyan('ugprade-all'),      'detects latest npm deps, updates package.json, and runs upgrade']);
	table.push([cyan('upgrade-critical'), 'detects security issues, updates package.json, and runs upgrade']);
	table.push([cyan('watch'),            'starts watching all packages to perform build']);

	console.log(table.toString() + '\n');
});

/*
 * helper functions
 */

function linkDeps() {
	const packagesDir = path.join(__dirname, 'packages');
	gutil.log('Linking dependencies...');

	return Promise.resolve()
		.then(() => runYarn(path.join(__dirname, 'core'), 'link').catch(() => {}))
		.then(() => fs.readdirSync(packagesDir).reduce((promise, dir) => {
			return promise.then(() => {
				try {
					if (fs.statSync(path.join(packagesDir, dir, 'package.json')).isFile()) {
						return runYarn(path.join(packagesDir, dir), 'link').catch(() => {});
					}
				} catch (e) {}
			});
		}, Promise.resolve()))
		.then(() => Object.keys(depmap).reduce((promise, name) => {
			return promise.then(() => {
				const dir = path.join(__dirname, name);
				return depmap[name].reduce((promise, pkg) => {
					return promise.then(() => runYarn(dir, 'link', pkg));
				}, Promise.resolve());
			});
		}, Promise.resolve()));
}

function buildDepList(pkg) {
	const list = [ pkg ];
	const paths = {};

	(function scan(pkg) {
		for (const dir of Object.keys(depmap)) {
			const name = pkg.split('/').pop();
			if (depmap[dir].indexOf(name) !== -1) {
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
	const args = Array.prototype.slice.call(arguments, 1);
	if (process.argv.indexOf('--json') !== -1 || process.argv.indexOf('--silent') !== -1) {
		args.push('--no-progress', '--no-emoji');
	}
	return run('yarn', args, { cwd: cwd || process.cwd() });
}

function runNPM(cwd) {
	return run('npm', Array.prototype.slice.call(arguments, 1));
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
	const paths = globule.find(['./package.json', './*/package.json', 'packages/*/package.json', 'plugins/*/package.json']).map(p => path.resolve(p));
	const packages = {};
	const deprecatedMap = {};

	gutil.log('Checking packages...');

	return paths
		.reduce((promise, packageJsonFile) => {
			return promise.then(() => {
				let pkgJson;
				try {
					pkgJson = JSON.parse(fs.readFileSync(packageJsonFile));
				} catch (err) {
					gutil.log(gutil.colors.red(err));
					return;
				}

				const packagePath = path.dirname(packageJsonFile);
				packages[packagePath] = {
					name: pkgJson.name,
					path: packagePath,
					packageJson: packageJsonFile,
					nodeSecurityIssues: [],
					yarnIssues: [],
					deprecated: {},
					dependencies: {},
					devDependencies: {},
					optionalDependencies: {}
				};

				['dependencies', 'devDependencies', 'optionalDependencies'].forEach(type => {
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

				return Promise
					.all([
						new Promise((resolve, reject) => {
							Nsp.check({
								package: pkgJson
							}, (err, data) => {
								if (err) {
									console.error('NSP failed!', err);
								} else {
									packages[packagePath].nodeSecurityIssues = data;
								}
								resolve();
							});
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
					]);
			});
		}, Promise.resolve())
		.then(() => {
			// now that we have a list of all unique dependencies, we need to
			// call `npm info` for each and see if the module is deprecated
			const deps = Object.keys(deprecatedMap).sort();
			return Promise
				.all(deps.map(dep => {
					if (deprecatedMap[dep] === null) {
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
					for (const packagePath of Object.keys(packages)) {
						for (const type of ['dependencies', 'devDependencies', 'optionalDependencies']) {
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
		criticalToUpdate: [],
		stats: computeSloc()
	};

	for (const key of Object.keys(packages)) {
		const pkg = packages[key];

		const vulnerablePackages = {};
		for (const issue of pkg.nodeSecurityIssues) {
			vulnerablePackages[issue.module] = issue;
		}
		results.dependencySecurityIssues += pkg.nodeSecurityIssues.length;

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
						if (!fs.lstatSync(path.join(key, 'node_modules', link)).isSymbolicLink()) {
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

		['dependencies', 'devDependencies', 'optionalDependencies'].forEach(type => {
			if (pkg[type] && Object.keys(pkg[type]).length) {
				for (const name of Object.keys(pkg[type])) {
					const dep = pkg[type][name];

					if (vulnerablePackages[name]) {
						const patched = vulnerablePackages[name].patched_versions;
						results.criticalToUpdate.push({
							path: key,
							name: name,
							current: dep.required,
							updated: (m ? m[1] : '') + (dep.stable && semver.satisfies(dep.stable, patched) ? dep.stable : semver.clean(patched))
						});
						results.securityIssues++;
						dep.status = 'security vulnerability';
					}

					if (!dep.installed) {
						results.missingDeps++;
						if (!dep.status) {
							dep.status = 'not installed';
						}
					}

					if (dep.required !== 'latest' && dep.required !== '*') {
						const range = semver.validRange(dep.installed || dep.required) || '';
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
			head: ['Name', 'Required', 'Installed', 'Stable', 'Latest', 'Status'],
			style: {
				head: ['bold'],
				border: []
			}
		});

		['dependencies', 'devDependencies', 'optionalDependencies'].forEach(type => {
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
					} else {
						table.push([ packageName, dep.required, red(dep.installed), dep.stable, dep.latest, red(dep.status) ]);
					}
				}
			}
		});

		console.log(table.toString() + '\n');

		if (pkg.nodeSecurityIssues.length) {
			console.log(gray(' Node Security Issues:'));
			for (const issue of pkg.nodeSecurityIssues) {
				console.log('   • ' + bold(issue.module));
				console.log('     ' + red(issue.title + ' <' + issue.advisory + '>'));
				table = new Table({
					chars: cliTableChars,
					head: [gray('Installed'), gray('Vulnerable'), gray('Patched'), gray('Path'), gray('Published'), gray('Updated')],
					style: {
						head: ['bold'],
						border: []
					}
				});
				table.push([ issue.version, issue.vulnerable_versions, issue.patched_versions, issue.path.map((p, i) => {
					if (i) {
						return (i > 1 ? (new Array((i*2)-1)).join(' ') : '') + '└ ' + p;
					}
					return p;
				}).join('\n'), new Date(issue.publish_date).toLocaleDateString(), new Date(issue.updated_at).toLocaleDateString() ]);
				console.log(table.toString().split('\n').map(s => '   ' + s).join('\n'));
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
				head: [gray('Package'), gray('Note')],
				style: {
					head: ['bold'],
					border: []
				}
			});
			for (const name of Object.keys(pkg.deprecated)) {
				table.push([ name, pkg.deprecated[name] ]);
			}
			console.log(table.toString().split('\n').map(s => '   ' + s).join('\n'));
		}

		console.log();
	}

	console.log(magenta('Source Code Stats') + '\n');
	table = new Table({ chars: cliTableChars, head: [], style: { head: ['bold'], border: [] } });
	const stats = results.stats;
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

	console.log(magenta('Summary') + '\n');
	table = new Table({ chars: cliTableChars, head: [], style: { head: ['bold'], border: [] } });
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

	if (results.criticalToUpdate.length || results.packagesToUpdate.length || Object.keys(results.needsFixing).length) {
		console.log(magenta('Recommendations') + '\n');

		if (results.criticalToUpdate.length) {
			console.log(`Run ${cyan('gulp upgrade-critical')} to update:`);
			table = new Table({
				chars: cliTableChars,
				head: [],
				style: {
					head: ['bold', 'gray'],
					border: []
				}
			});
			for (const pkg of results.criticalToUpdate) {
				let rel = path.relative(__dirname, pkg.path) || path.basename(pkg.path);
				table.push([rel, pkg.name, pkg.current, '→', hlVer(pkg.updated, pkg.current)]);
			}
			console.log(table.toString() + '\n');
		}

		if (results.packagesToUpdate.length) {
			console.log(`Run ${cyan('gulp upgrade-all')} to update:`);
			table = new Table({
				chars: cliTableChars,
				head: ['Component', 'Package', 'From', 'To'],
				style: {
					head: ['bold', 'gray'],
					border: []
				}
			});
			for (const pkg of results.packagesToUpdate) {
				let rel = path.relative(__dirname, pkg.path) || path.basename(pkg.path);
				table.push([rel, pkg.name, pkg.current, '→', hlVer(pkg.updated, pkg.current)]);
			}
			console.log(table.toString() + '\n');
		}

		if (Object.keys(results.needsFixing).length) {
			console.log(`Run ${cyan('gulp fix')} to fix node_modules:`);
			table = new Table({
				chars: cliTableChars,
				head: ['Component', 'Action'],
				style: {
					head: ['bold', 'gray'],
					border: []
				}
			});
			for (const pkg of Object.keys(results.needsFixing)) {
				let rel = path.relative(__dirname, pkg) || path.basename(pkg);
				table.push([rel, fixReasons[results.needsFixing[pkg]] || 'unknown']);
			}
			console.log(table.toString() + '\n');
		}
	}
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
			['dependencies', 'devDependencies', 'optionalDependencies'].forEach(type => {
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

function computeSloc() {
	const srcDirs = [];
	const sloc = require('sloc');
	const supported = sloc.extensions;
	const counters = { total: 0, source: 0, comment: 0, single: 0, block: 0, mixed: 0, empty: 0, todo: 0, files: 0 };

	globule
		.find(['./*/package.json', 'packages/*/package.json', 'plugins/*/package.json'])
		.forEach(pkgJson => {
			const dir = path.join(path.dirname(path.resolve(pkgJson)), 'src');
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
