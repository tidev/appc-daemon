const fs     = require('fs');
const Module = require('module');
const path   = require('path');

const profiles = {
	node4: {
		plugins: [
			'@babel/plugin-proposal-class-properties',
			'@babel/plugin-proposal-object-rest-spread',
			'@babel/plugin-transform-async-to-generator',
			'@babel/plugin-transform-destructuring',
			'@babel/plugin-transform-modules-commonjs',
			'@babel/plugin-transform-parameters',
			'dynamic-import-node'
		]
	},

	node6: {
		plugins: [
			'@babel/plugin-proposal-class-properties',
			'@babel/plugin-proposal-object-rest-spread',
			'@babel/plugin-transform-async-to-generator',
			'@babel/plugin-transform-destructuring',
			'@babel/plugin-transform-modules-commonjs',
			'dynamic-import-node'
		]
	},

	node7: {
		plugins: [
			'@babel/plugin-proposal-class-properties',
			'@babel/plugin-proposal-object-rest-spread',
			'@babel/plugin-transform-modules-commonjs',
			'dynamic-import-node'
		]
	},

	node8: {
		plugins: [
			'@babel/plugin-proposal-class-properties',
			'@babel/plugin-proposal-object-rest-spread',
			'@babel/plugin-transform-modules-commonjs',
			'dynamic-import-node'
		]
	},

	node10: {
		plugins: [
			'@babel/plugin-proposal-class-properties',
			'@babel/plugin-transform-modules-commonjs',
			'dynamic-import-node'
		]
	},

	node12: {
		plugins: [
			'@babel/plugin-transform-modules-commonjs',
			'dynamic-import-node'
		]
	}
};

module.exports = function getBabelConf(opts) {
	const name = process.env.APPCD_BABEL_CONF = [
		opts && opts.babel,
		process.env.APPCD_BABEL_CONF,
		'node8'
	].reduce((p, n) => !p && n && profiles[n] ? n : p);

	return profiles[name];
};
