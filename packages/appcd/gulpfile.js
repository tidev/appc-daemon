'use strict';

require('appcd-gulp')({
	gulp:     require('gulp'),
	pkgJson:  require('./package.json'),
	template: 'package',
	babel:    'node8'
});
