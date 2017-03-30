if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Config from './config';
import path from 'path';

import { isFile } from 'appcd-fs';

export default Config;

/**
 * Creates a `Config` instance and loads the specified configuration and
 * environment specific configuration files.
 *
 * @param {Object} [opts] - Various options.
 * @param {Object} [opts.config] - An object with various config settings. The
 * config object will be initialized with these values, however if any user-
 * defined or environment specific config files are loaded, then this object
 * will be re-merged since it always takes precedence.
 * @param {String} [opts.configFile] - Path to a config file to load. It may be
 * a JavaScript or JSON file.
 * @param {String} [opts.defaultConfigFile] - Path to the default config file to load. The default
 * config file is loaded first before the config file, if specified.
 * @returns {Config}
 */
export function load({ config, configFile, defaultConfigFile } = {}) {
	const cfg = new Config({ config, configFile: defaultConfigFile });
	let remerge = false;

	// load the user-defined config file
	if (configFile) {
		cfg.load(configFile);
		remerge = true;
	}

	// now that the config has been loaded, we can determine the environment
	const env = cfg.get('environment') && cfg.get('environment.name') || cfg.get('environment') || 'preprod';
	const paths = [];

	if (defaultConfigFile) {
		paths.push(
			path.join(path.dirname(defaultConfigFile), `${env}.js`),
			path.join(path.dirname(defaultConfigFile), `${env}.json`)
		);
	}

	if (configFile) {
		paths.push(
			path.join(path.dirname(configFile), `${env}.js`),
			path.join(path.dirname(configFile), `${env}.json`)
		);
	}

	// load environment specific config files
	for (const file of paths) {
		if (isFile(file)) {
			cfg.load(file);
			remerge = true;
		}
	}

	if (remerge && config) {
		cfg.merge(config);
	}

	return cfg;
}
