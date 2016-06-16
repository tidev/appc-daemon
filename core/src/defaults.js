import { existsSync, mergeDeep } from './util';
import fs from 'fs';
import path from 'path';

const pkgJson = require('../package.json');

const defaults = {
	analytics: {
		enabled: true,
		eventsDir: '~/.appcelerator/appcd/analytics',
		sendBatchSize: 10,
		url: 'https://api.appcelerator.net/p/v2/partner-track',
		userAgent: `Node script: ${process.mainModule.filename}`
	},
	appc: {
		home: '~/.appcelerator'
	},
	appcd: {
		allowExit: true,
		configFile: '~/.appcelerator/appcd/config.js',
		daemonize: false,
		home: '~/.appcelerator/appcd',
		pidFile: '~/.appcelerator/appcd/appcd.pid',
		pkgJson,
		skipPluginCheck: false,
		version: pkgJson.version
	},
	logger: {
		colors: true,
		silent: false
	},
	network: {
		caFile: null,
		proxy: null,
		strictSSL: true
	},
	paths: {
		plugins: []
	}
};

const environments = {};

environments.production = {
	appcd: {
		guid: 'ea327577-858f-4d31-905e-fa670f50ef48'
	},
	environment: 'production'
};

environments.preproduction = {
	appcd: {
		guid: '14c84daf-b01e-486c-96d3-b8f66da44481'
	},
	environment: 'preproduction'
};

/**
 * Returns the default config.
 *
 * @returns {Object}
 */
export function getDefaultConfig() {
	return defaults;
}

/**
 * Returns the environment-specific config. If no environment is specified, it
 * will automatically guess.
 *
 * @param {String} [env] - The environment name.
 * @returns {Object}
 */
export function getEnvironmentConfig(env) {
	if (!env) {
		const parentPkgJsonFile = path.resolve(__dirname, '..', 'package.json');
		const parentPkgJson = existsSync(parentPkgJsonFile) ? require(parentPkgJsonFile) : {};

		if (pkgJson._id || pkgJson._from || parentPkgJson._id || parentPkgJson._from) {
			env = 'production';
		} else {
			env = 'preproduction';
		}
	}

	return environments[env] || { ...environments.preproduction, environment: env };
}
