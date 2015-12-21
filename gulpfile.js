const $ = require('gulp-load-plugins')();
const gulp = require('gulp');
const path = require('path');
const spawn = require('child_process').spawn;
const sync = require('gulp-sync')(gulp).sync;

/*
 * build tasks
 */
gulp.task('build', function () {
	// build appcd, core, and plugins
	return gulp
		.src([
			'appcd/gulpfile.js',
			'appcd-core/gulpfile.js',
			'plugins/*/gulpfile.js'
		])
		.pipe($.chug({
			tasks: ['build']
		}));
});

/*
 * watch/debug tasks
 */
gulp.task('restart-daemon', spawn.bind(null, process.execPath, ['appcd/bin/appcd', 'restart', '--debug'], { stdio: 'inherit' }));

gulp.task('watch', sync(['build', 'restart-daemon']), function () {
	console.log('ready');
	//gulp.watch('src/**/*.js', sync(['build-src', 'restart-daemon']));
	//gulp.watch('plugins/**/*.js', sync(['build-plugins', 'restart-daemon']));
});

gulp.task('default', ['build']);
