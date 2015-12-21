const $ = require('gulp-load-plugins')();
const del = require('del');
const gulp = require('gulp');
const path = require('path');
const spawn = require('child_process').spawn;
const sync = require('gulp-sync')(gulp).sync;

const distDir = path.join(__dirname, 'dist');
const babelOptions = {
	presets: ['es2016-node5']
};

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
		.pipe($.babel(babelOptions))
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
 * build tasks
 */
// gulp.task('build', function () {
// 	// build appcd, core, and plugins
// 	return gulp
// 		.src([
// 			'appcd/gulpfile.js',
// 			'appcd-core/gulpfile.js',
// 			'plugins/*/gulpfile.js'
// 		])
// 		.pipe($.chug({
// 			tasks: ['build']
// 		}));
// });

/*
 * watch/debug tasks
 */
gulp.task('restart-daemon', spawn.bind(null, process.execPath, ['appcd/bin/appcd', 'restart', '--debug'], { stdio: 'inherit' }));

gulp.task('watch', sync(['build', 'restart-daemon']), function () {
	console.log('ready');
	gulp.watch('src/**/*.js', sync(['build', 'restart-daemon']));
	//gulp.watch('plugins/**/*.js', sync(['build-plugins', 'restart-daemon']));
});

gulp.task('default', ['build']);
