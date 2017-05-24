'use strict';

const babelRE = /^(babel-\w+-)/;
const Module = require('module');
const babel = require('./babel.json');
const conf = babel[process.env.APPCD_BABEL_CONF || 'node4'] || {};
Object.keys(conf).forEach(function (key) {
	if ((key === 'plugins' || key === 'presets') && Array.isArray(conf[key])) {
		for (var i = 0; i < conf[key].length; i++) {
			var name = conf[key][i];
			if (name.indexOf('babili') !== -1) {
				conf[key].splice(i--, 1);
			} else {
				conf[key][i] = Module._resolveFilename(babelRE.test(name) ? name : 'babel-' + key.slice(0, -1) + '-' + name, module);
			}
		}
	} else {
		delete conf[key];
	}
});
conf.only = process.cwd() + '/test/';
conf.cache = false;
// console.log(conf);
require('babel-register')(conf);
require('babel-polyfill');

global.chai = require('chai');
global.chai.use(require('sinon-chai'));
global.expect = global.chai.expect;
global.sinon = require('sinon');

beforeEach(function () {
	this.sandbox = global.sinon.sandbox.create();
	global.spy = this.sandbox.spy.bind(this.sandbox);
	global.stub = this.sandbox.stub.bind(this.sandbox);
});

afterEach(function () {
	delete global.spy;
	delete global.stub;
	this.sandbox.restore();
});
