'use strict';

const chug = require('gulp-chug');
const fs = require('fs');
const gulp = require('gulp');
const path = require('path');
const runSequence = require('run-sequence');
const spawn = require('child_process').spawn;

function runYarn(dir, ...args) {
	return new Promise((resolve, reject) => {
		const child = spawn(
			process.execPath,
			[ path.resolve(__dirname, 'node_modules', 'yarn', 'bin', 'yarn.js') ].concat(args),
			{
				cwd: dir,
				stdio: 'inherit'
			}
		);
		child.on('close', code => {
			// always resolve?
			resolve();
		});
	});
}

/*
 * install tasks
 */
gulp.task('install', () => {
	return runSequence('install-deps', 'link', 'build');
});

gulp.task('install-deps', callback => {
	const dirs = ['bootstrap', 'client', 'core'].map(dir => path.resolve(__dirname, dir));
	const pluginsDir = path.join(__dirname, 'plugins');
	fs.readdirSync(pluginsDir).forEach(dir => {
		try {
			if (fs.statSync(path.join(pluginsDir, dir, 'package.json'))) {
				dirs.push(path.join(pluginsDir, dir));
			}
		} catch (e) {
			// squeltch
		}
	});

	Promise
		.all(dirs.map(dir => runYarn(dir, 'install')))
		.then(() => callback(), callback);
});

gulp.task('link', callback => {
	Promise.resolve()
		.then(() => runYarn(path.join(__dirname, 'client'), 'link'))
		.catch(() => {})
		.then(() => runYarn(path.join(__dirname, 'bootstrap'), 'link', 'appcd-client'))
		.then(() => callback(), callback);
});

/*
 * build tasks
 */
gulp.task('build', ['build-bootstrap', 'build-client', 'build-core', 'build-plugins']);

gulp.task('build-bootstrap', () => {
	return gulp
		.src(__dirname + '/bootstrap/gulpfile.js')
		.pipe(chug({ tasks: ['build'] }));
});

gulp.task('build-client', () => {
	return gulp
		.src(__dirname + '/client/gulpfile.js')
		.pipe(chug({ tasks: ['build'] }));
});

gulp.task('build-core', () => {
	return gulp
		.src(__dirname + '/core/gulpfile.js')
		.pipe(chug({ tasks: ['build'] }));
});

gulp.task('build-plugins', () => {
	return gulp
		.src(__dirname + '/plugins/*/gulpfile.js')
		.pipe(chug({ tasks: ['build'] }));
});

/*
 * watch/debug tasks
 */
let children = 0;
gulp.task('restart-daemon', () => {
	const child = spawn(process.execPath, ['bootstrap/bin/appcd', 'restart', '--debug'], { stdio: 'inherit' });
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
		gulp.watch(__dirname + '/bootstrap/src/**/*.js', () => {
			runSequence('build-bootstrap', 'restart-daemon');
		});
		gulp.watch(__dirname + '/client/src/**/*.js', () => {
			runSequence('build-client', 'restart-daemon');
		});
		gulp.watch(__dirname + '/core/src/**/*.js', () => {
			runSequence('build-core', 'restart-daemon');
		});
		gulp.watch(__dirname + '/plugins/*/src/**/*.js', () => {
			runSequence('build-plugins', 'restart-daemon');
		});
	});
});

gulp.task('default', ['build']);
