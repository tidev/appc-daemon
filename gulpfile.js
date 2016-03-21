'use strict';

var $ = require('gulp-load-plugins')();
var del = require('del');
var fs = require('fs');
var gulp = require('gulp');
var manifest = require('./package.json');
var path = require('path');
var runSequence = require('run-sequence');
var spawn = require('child_process').spawn;

var coverageDir = path.join(__dirname, 'coverage');
var distDir = path.join(__dirname, 'dist');
var docsDir = path.join(__dirname, 'docs');

/*
 * Clean tasks
 */
gulp.task('clean', ['clean-coverage', 'clean-dist', 'clean-docs']);

gulp.task('clean-coverage', function (done) {
	del([coverageDir]).then(function () { done(); });
});

gulp.task('clean-dist', function (done) {
	del([distDir]).then(function () { done(); });
});

gulp.task('clean-docs', function (done) {
	del([docsDir]).then(function () { done(); });
});

/*
 * build tasks
 */
gulp.task('build', ['build-src', 'build-core']);

gulp.task('build-src', ['clean-dist', 'lint-src'], function () {
	return gulp
		.src('src/**/*.js')
		.pipe($.plumber())
		.pipe($.debug({ title: 'build' }))
		.pipe($.sourcemaps.init())
		.pipe($.babel())
		.pipe($.sourcemaps.write('.'))
		.pipe(gulp.dest(distDir));
});

gulp.task('build-core', function () {
	return gulp
		.src('core/gulpfile.js')
		.pipe($.chug({
			tasks: ['build']
		}));
});

gulp.task('build-core-src', function () {
	return gulp
		.src('core/gulpfile.js')
		.pipe($.chug({
			tasks: ['build-src']
		}));
});

gulp.task('build-core-plugins', function () {
	return gulp
		.src('core/plugins/*/gulpfile.js')
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
				{ name: 'esdoc-es7-plugin' }
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
gulp.task('test', ['lint-test', 'build'], function () {
	var suite, grep;
	var p = process.argv.indexOf('--suite');
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
		.pipe($.filter(suite ? ['test/setup.js'].concat(suite.split(',').map(function (s) { return 'test/**/test-' + s + '.js'; })) : 'test/**/*.js'))
		.pipe($.mocha({ grep: grep }));
});

gulp.task('coverage', ['lint-src', 'build-plugins', 'lint-test', 'clean-coverage', 'clean-dist'], function (cb) {
	gulp.src('src/**/*.js')
		.pipe($.plumber())
		.pipe($.debug({ title: 'build' }))
		.pipe($.sourcemaps.init())
		.pipe($.babelIstanbul())
		.pipe($.sourcemaps.write('.'))
		.pipe(gulp.dest(distDir))
		.on('finish', function () {
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
		gulp.watch('core/src/**/*.js', function () {
			runSequence('build-core-src', 'restart-daemon');
		});
		gulp.watch('core/plugins/*/src/**/*.js', function () {
			runSequence('build-core-plugins', 'restart-daemon');
		});
	});
});

gulp.task('default', ['build']);
