'use strict';

const $ = require('gulp-load-plugins')();
const del = require('del');
const fs = require('fs');
const gulp = require('gulp');
const manifest = require('./package.json');
const path = require('path');
const runSequence = require('run-sequence');
const spawn = require('child_process').spawn;

const coverageDir = path.join(__dirname, 'coverage');
const distDir = path.join(__dirname, 'dist');
const docsDir = path.join(__dirname, 'docs');

/*
 * Clean tasks
 */
gulp.task('clean', ['clean-coverage', 'clean-dist', 'clean-docs']);

gulp.task('clean-coverage', done => { del([coverageDir]).then(() => done()) });

gulp.task('clean-dist', done => { del([distDir]).then(() => done()) });

gulp.task('clean-docs', done => { del([docsDir]).then(() => done()) });

/*
 * build tasks
 */
gulp.task('build', ['build-src', 'build-plugins']);

gulp.task('build-src', ['clean-dist', 'lint-src'], () => {
	return gulp
		.src('src/**/*.js')
		.pipe($.plumber())
		.pipe($.debug({ title: 'build' }))
		.pipe($.sourcemaps.init())
		.pipe($.babel())
		.pipe($.sourcemaps.write('.'))
		.pipe(gulp.dest(distDir));
});

gulp.task('build-plugins', () => {
	return gulp
		.src('plugins/*/gulpfile.js')
		.pipe($.chug({
			tasks: ['build']
		}));
});

gulp.task('docs', ['lint-src', 'clean-docs'], () => {
	return gulp.src('src')
		.pipe($.plumber())
		.pipe($.debug({ title: 'docs' }))
		.pipe($.esdoc({
			// debug: true,
			destination: docsDir,
			plugins: [
				{ name: 'esdoc-es7-plugin' }
			],
			title: manifest.name
		}));
});

/*
gulp.task('prepublish', done => {
	if (process.env.npm_lifecycle_event !== 'prepublish') {
		console.error('This task is meant to be run via "npm install"');
		process.exit(1);
	}

	const pluginsDir = path.join(__dirname, 'plugins');
	const toDel = [];
	const plugins = fs.readdirSync(pluginsDir)
		.map(name => path.join(pluginsDir, name))
		.filter(p => {
			try {
				if (fs.statSync(p).isDirectory()) {
					toDel.push(path.join(p, 'node_modules'), path.join(p, 'npm-debug.log'), path.join(p, 'npm-shrinkwrap.json'));
					return true;
				}
			} catch (e) {
				// not a plugin directory
			}
		});

	toDel.forEach(s => console.log('Deleting:', s));

	Promise.resolve()
		.then(() => del(toDel))
		.then(() => Promise.all(plugins.map(pluginDir => new Promise((resolve, reject) => {
			console.log('Running: ' + process.execPath + ' ' + process.env.npm_execpath + ' install -- cwd=' + pluginDir);
			spawn(
				process.execPath,
				[ process.env.npm_execpath, 'install' ],
				{ cwd: pluginDir, stdio: 'inherit' }
			).on('close', code => code ? reject(code) : resolve());
		}))))
		.then(() => new Promise((resolve, reject) => {
			console.log('Running gulp build task');
			gulp.start('build', err => err ? reject(err) : resolve());
		}))
		.then(() => new Promise((resolve, reject) => {
			console.log('Running: ' + process.execPath + ' ' + process.env.npm_execpath + ' prune -- cwd=' + __dirname);
			spawn(
				process.execPath,
				[ process.env.npm_execpath, 'prune' ],
				{ cwd: __dirname, stdio: 'inherit' }
			).on('close', code => code ? reject(code) : resolve());
		}))
		.then(() => new Promise((resolve, reject) => {
			console.log('Running: ' + process.execPath + ' ' + process.env.npm_execpath + ' shrinkwrap -- cwd=' + __dirname);
			spawn(
				process.execPath,
				[ process.env.npm_execpath, 'shrinkwrap' ],
				{ cwd: __dirname, stdio: 'inherit' }
			).on('close', code => code ? reject(code) : resolve());
		}))
		.then(done)
		.catch(done);
});
*/

/*
 * lint tasks
 */
function lint(pattern) {
	return gulp.src(pattern)
		.pipe($.plumber())
		.pipe($.eslint())
		.pipe($.eslint.format())
		.pipe($.eslint.failAfterError());
}

gulp.task('lint-src', () => lint('src/**/*.js'));

gulp.task('lint-test', () => lint('test/**/test-*.js'));

/*
 * test tasks
 */
gulp.task('test', ['lint-test', 'build'], () => {
	let suite;
	let grep;
	let p = process.argv.indexOf('--suite');
	if (p !== -1 && p + 1 < process.argv.length) {
		suite = process.argv[p + 1];
	}
	p = process.argv.indexOf('--grep');
	if (p !== -1 && p + 1 < process.argv.length) {
		grep = process.argv[p + 1];
	}

	return gulp.src('test/**/*.js')
		.pipe($.plumber())
		.pipe($.debug({ title: 'test' }))
		.pipe($.babel())
		.pipe($.injectModules())
		.pipe($.filter(suite ? ['test/setup.js'].concat(suite.split(',').map(s => 'test/**/test-' + s + '.js')) : 'test/**/*.js'))
		.pipe($.mocha({ grep: grep }));
});

gulp.task('coverage', ['lint-src', 'build-plugins', 'lint-test', 'clean-coverage', 'clean-dist'], cb => {
	gulp.src('src/**/*.js')
		.pipe($.plumber())
		.pipe($.debug({ title: 'build' }))
		.pipe($.sourcemaps.init())
		.pipe($.babelIstanbul())
		.pipe($.sourcemaps.write('.'))
		.pipe(gulp.dest(distDir))
		.on('finish', () => {
			gulp.src('test/**/*.js')
				.pipe($.plumber())
				.pipe($.debug({ title: 'test' }))
				.pipe($.babel())
				.pipe($.injectModules())
				.pipe($.mocha())
				.pipe($.babelIstanbul.writeReports())
				.on('end', cb);
		});
});

/*
 * watch/debug tasks
 */
let children = 0;
gulp.task('restart-daemon', () => {
	const child = spawn(process.execPath, ['../bin/appcd', 'restart', '--debug'], { stdio: 'inherit' });
	children++;
	child.on('exit', () => {
		// if appcd is killed via kill(1), then we force gulp watch to exit
		if (--children < 1) {
			process.exit(0);
		}
	});
});

gulp.task('watch', () => {
	runSequence('build', 'restart-daemon', () => {
		gulp.watch('src/**/*.js', () => {
			runSequence('build-src', 'restart-daemon');
		});
		gulp.watch('plugins/*/src/**/*.js', () => {
			runSequence('build-plugins', 'restart-daemon');
		});
	});
});

gulp.task('default', ['build']);
