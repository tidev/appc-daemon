'use strict';

if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

const babelRE = /^(babel-\w+-)/;
const Module = require('module');
const babel = require('./babel.json');
const conf = babel[process.env.APPCD_BABEL_CONF || 'node4'] || {};
['plugins', 'presets'].forEach(function (type) {
	if (Array.isArray(conf[type])) {
		conf[type].forEach(function (name, i) {
			conf[type][i] = Module._resolveFilename(babelRE.test(name) ? name : 'babel-' + type.slice(0, -1) + '-' + name, module);
		});
	}
});
conf.only = new RegExp(process.cwd() + '/(test|src)/');
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
