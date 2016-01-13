'use strict';

const $ = require('gulp-load-plugins')();
const del = require('del');
const fs = require('fs');
const gulp = require('gulp');
const path = require('path');
const runSequence = require('run-sequence');
const spawn = require('child_process').spawn;

const manifest = require('./package.json');
const distDir = path.join(__dirname, 'dist');
const docsDir = path.join(__dirname, 'docs');
const babelOptions = {
	presets: ['es2016-node5'],
	plugins: ['transform-decorators-legacy', 'transform-class-properties']
};

/*
 * Clean tasks
 */
gulp.task('clean', ['clean-dist', 'clean-docs']);

gulp.task('clean-dist', function (done) {
	del([distDir]).then(function () { done(); });
});

gulp.task('clean-docs', function (done) {
	del([docsDir]).then(function () { done(); });
});

/*
 * build tasks
 */
gulp.task('build', ['build-src', 'build-plugins']);

gulp.task('build-src', ['clean-dist', 'lint-src'], function () {
	return gulp
		.src('src/**/*.js')
		.pipe($.plumber())
		.pipe($.debug({ title: 'build' }))
		.pipe($.sourcemaps.init())
		.pipe($.babel(babelOptions))
		.pipe($.sourcemaps.write('.'))
		.pipe(gulp.dest(distDir));
});

gulp.task('build-plugins', function () {
	return gulp
		.src('plugins/*/gulpfile.js')
		.pipe($.chug({
			tasks: ['build']
		}));
});

gulp.task('docs', ['lint-src', 'clean-docs'], function () {
	return gulp.src('src')
		.pipe($.plumber())
		.pipe($.debug({ title: 'docs' }))
		.pipe($.esdoc({
			// debug: true,
			destination: docsDir,
			plugins: [
				{ name: "esdoc-es7-plugin" }
			],
			title: manifest.name
		}));
});

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

	var jsFilter = $.filter('**/*.js', { restore: true });

	return gulp
		.src(['test/**'])
		.pipe($.plumber())
		.pipe($.debug({ title: 'test' }))
		.pipe(jsFilter)
		.pipe($.sourcemaps.init())
		.pipe($.babel(babelOptions))
		.pipe($.sourcemaps.write('.'))
		.pipe(jsFilter.restore)
		.pipe(gulp.dest(distDir + '/test'))
		.pipe($.filter('**/*.js'))
		.pipe($.mocha({
			globals: [],
			grep: grep,
			reporter: 'spec',
			ui: 'bdd'
		}));
});

gulp.task('default', ['test']);

/*
 * watch/debug tasks
 */
var children = 0;
gulp.task('restart-daemon', function () {
	var child = spawn(process.execPath, ['bin/appcd', 'restart', '--debug'], { stdio: 'inherit' });
	children++;
	child.on('exit', function () {
		// if appcd is killed via kill(1), then we force gulp watch to exit
		if (--children < 1) {
			process.exit(0);
		}
	});
});

gulp.task('watch', function () {
	runSequence('build', 'restart-daemon', function () {
		gulp.watch('src/**/*.js', function () {
			runSequence('build-src', 'restart-daemon');
		});
		gulp.watch('plugins/*/src/**/*.js', function () {
			runSequence('build-plugins', 'restart-daemon');
		});
	});
});

gulp.task('default', ['build']);
