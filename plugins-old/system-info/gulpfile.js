'use strict';

const $ = require('gulp-load-plugins')();
const del = require('del');
const gulp = require('gulp');
const path = require('path');
const spawn = require('child_process').spawn;

const distDir = path.join(__dirname, 'dist');

/*
 * Clean tasks
 */
gulp.task('clean', ['clean-dist']);

gulp.task('clean-dist', function (done) {
	del([distDir]).then(function () { done(); });
});

/*
 * build tasks
 */
gulp.task('build', ['clean-dist', 'lint-src'], function () {
	return gulp
		.src('src/**/*.js')
		.pipe($.plumber())
		.pipe($.debug({ title: 'build-src' }))
		.pipe($.sourcemaps.init())
		.pipe($.babel())
		.pipe($.sourcemaps.write('.'))
		.pipe(gulp.dest(distDir));
});

/*
 * lint tasks
 */
function lint(pattern) {
	return gulp.src(pattern)
		.pipe($.plumber())
		.pipe($.eslint())
		.pipe($.eslint.format())
		.pipe($.eslint.failOnError());
}

gulp.task('lint-src', function () {
	return lint('src/**/*.js');
});

gulp.task('lint-test', function () {
	return lint('test/**/test-*.js');
});

/*
 * test tasks
 */
gulp.task('test', ['build', 'lint-test'], function () {
	var grep;
	var p = process.argv.indexOf('--suite');
	if (p !== -1 && p + 1 < process.argv.length) {
		grep = process.argv[p + 1];
	}

	return gulp.src(['src/**/*.js', 'test/**/*.js'])
		.pipe($.plumber())
		.pipe($.debug({ title: 'build' }))
		.pipe($.babel())
		.pipe($.injectModules())
		.pipe($.filter('test/**/*.js'))
		.pipe($.debug({ title: 'test' }))
		.pipe($.mocha({ grep: grep }));
});

gulp.task('default', ['test']);
