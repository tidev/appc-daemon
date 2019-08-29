import Config from 'appcd-config';
import path from 'path';

import { expandPath } from 'appcd-path';
import { isFile } from 'appcd-fs';

/**
 * Initializes the Appc Daemon configuration, loads the default and user-defined config files, and
 * applies the command line runtime configuration.
 *
 * @param {Object} [opts] - Various options.
 * @param {Object} [opts.config] - A object to initialize the config with. Note that if a
 * `configFile` is also specified, this `config` is applied AFTER the config file has been loaded.
 * @param {String} [opts.configFile] - The path to a .js or .json config file to load.
 * @returns {Config}
 */
export function loadConfig({ config, configFile } = {}) {
	const cfg = new Config({
		baseConfigFile: path.resolve(__dirname, '..', 'conf', 'default.js'),
		config,
		configFile
	});

	// load the user-defined config file
	const cfgFile = expandPath(cfg.get('home'), 'config.json');
	if (isFile(cfgFile)) {
		cfg.load(cfgFile, { skipIfNotExists: true });

		const env = cfg.get('environment') && cfg.get('environment.name') || cfg.get('environment') || 'development';
		cfg.load(path.join(path.dirname(cfgFile), `${env}.js`), { skipIfNotExists: true });
		cfg.load(path.join(path.dirname(cfgFile), `${env}.json`), { skipIfNotExists: true });
	}

	return cfg;
}
