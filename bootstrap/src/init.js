import Config from 'appcd-config';
import debug from 'debug';
import path from 'path';

import { isFile } from 'appcd-fs';

const log = debug('appcd:init');

/**
 * Loads the appcd configuration.
 *
 * @param {Object} [opts] - Various options.
 * @param {Object} [opts.config] - An object with various config settings. The
 * config object will be initialized with these values, however if any user-
 * defined or environment specific config files are loaded, then this object
 * will be re-merged since it always takes precedence.
 * @param {String} [opts.configFile] - Path to a config file to load. It may be
 * a JavaScript or JSON file.
 * @returns {Config}
 */
export function config({ config, configFile } = {}) {
	const cfg = new Config({ config, configFile: path.resolve(__dirname, '../../conf/default.js') });
	let remerge = false;

	// load the user-defined config file
	if (isFile(configFile)) {
		cfg.load(configFile);
		remerge = true;
	}

	// now that the config has been loaded, we can determine the environment
	const env = cfg.get('environment') && cfg.get('environment.name') || cfg.get('environment') || 'preprod';

	// load environment specific config files
	const paths = [
		path.resolve(__dirname, `../../conf/${env}.js`),
		path.resolve(__dirname, `../../conf/${env}.json`),
		configFile && path.join(path.dirname(configFile), `${env}.js`),
		configFile && path.join(path.dirname(configFile), `${env}.json`)
	];
	for (const file of paths) {
		if (isFile(file)) {
			cfg.load(file);
			remerge = true;
		}
	}

	if (remerge && config) {
		cfg.merge(config);
	}

	log(cfg.toString());

	return cfg;
}
