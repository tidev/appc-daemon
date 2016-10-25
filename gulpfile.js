'use strict';

const chug = require('gulp-chug');
const gulp = require('gulp');
const path = require('path');
const runSequence = require('run-sequence');
const spawn = require('child_process').spawn;
const yarn = require('yarn');

/*
 * install task
 */
gulp.task('install', () => {
});

/*
 * build tasks
 */
gulp.task('build', ['build-bootstrap', 'build-core']); //, 'build-plugins']);

gulp.task('build-bootstrap', () => {
	return gulp
		.src(__dirname + '/bootstrap/gulpfile.js')
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
	const child = spawn(process.execPath, ['bin/appcd', 'restart', '--debug'], { stdio: 'inherit' });
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
		gulp.watch(__dirname + '/core/src/**/*.js', () => {
			runSequence('build-core', 'restart-daemon');
		});
		// gulp.watch(__dirname + '/plugins/*/src/**/*.js', () => {
		// 	runSequence('build-plugins', 'restart-daemon');
		// });
	});
});

gulp.task('default', ['build']);
