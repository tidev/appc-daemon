'use strict';

// dependency mappings used to wiring up yarn links and build order
const chug        = require('gulp-chug');
const david       = require('david');
const debug       = require('gulp-debug');
const del         = require('del');
const depmap      = require('./dependency-map.json');
const fs          = require('fs');
const globule     = require('globule');
const gulp        = require('gulp');
const gutil       = require('gulp-util');
const Nsp         = require('nsp');
const path        = require('path');
const runSequence = require('run-sequence');
const semver      = require('semver');
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

gulp.task('install-deps', callback => {
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

function buildTask(dir) {
	return () => gulp
		.src(path.join(__dirname, dir))
		.pipe(chug({ tasks: ['build'] }));
}

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
	table.push([cyan('check'),            'checks missing/outdated dependencies/link and security issues']);
	table.push([cyan('fix'),              'fixes any missing dependencies or links']);
	table.push([cyan('install'),          'links/installs dependencies, then does a full build']);
	table.push([cyan('install-deps'),     'installs each package\'s npm dependencies']);
	table.push([cyan('link'),             'ensures all links are wired up']);
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

function runYarn(cwd) {
	const args = Array.prototype.slice.call(arguments, 1);
	if (process.argv.indexOf('--json') !== -1 || process.argv.indexOf('--silent') !== -1) {
		args.push('--no-progress', '--no-emoji');
	}
	args.unshift(path.resolve(__dirname, 'node_modules', 'yarn', 'bin', 'yarn.js'));
	gutil.log('Running: CWD=' + cwd, process.execPath, args.join(' '));
	return Promise.resolve(spawnSync(process.execPath, args, { cwd: cwd }));
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
			const result = {};
			if (err) {
				gutil.log(gutil.colors.red('David failed! ' + (err.message || err.toString())));
			} else {
				for (const dep of Object.keys(deps)) {
					result[dep] = {};
					for (const key of Object.keys(deps[dep])) {
						dest[type][dep][key] = deps[dep][key];
					}
				}
			}
			resolve(result);
		});
	});
}

function checkPackages() {
	const paths = globule.find(['./package.json', './*/package.json', 'packages/*/package.json', 'plugins/*/package.json']).map(p => path.resolve(p));
	const packages = {};

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

							packages[packagePath][type][dep] = {
								installed: installed,
								required: pkgJson[type][dep]
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
		packagesToUpdate: [],
		criticalToUpdate: []
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
					} else if (dep.status === 'out-of-date') {
						table.push([ packageName, dep.required, red(dep.installed), green(dep.stable), dep.latest, red(dep.status) ]);
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

		console.log();
	}

	console.log(magenta('Summary') + '\n');
	table = new Table({
		chars: cliTableChars,
		head: [],
		style: {
			head: ['bold'],
			border: []
		}
	});
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
