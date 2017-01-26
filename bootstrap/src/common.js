import Config from 'appcd-config';
import debug from 'debug';
import fs from 'fs';
import path from 'path';

import { expandPath} from 'appcd-path';
import { isFile } from 'appcd-fs';
import { spawnNode } from 'appcd-nodejs';

const log = debug('appcd:common');

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
export function loadConfig({ config, configFile } = {}) {
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

/**
 * Spawns the Appc Daemon core.
 *
 * @param {Object} params - Various parameters.
 * @param {Array} [params.args] - Arguments to pass into the core such as the
 * command.
 * @param {Config} params.cfg - The configuration object.
 * @param {Boolean} [params.debug=false] - When true, spawns the core with stdio
 * inherited and does not detach the child process.
 * @returns {Promise}
 */
export function spawnCore({ args, cfg, debug }) {
	// find the appcd core
	const corePkgJson = JSON.parse(fs.readFileSync(require.resolve('appcd-core/package.json'), 'utf8'));
	let nodeVer = corePkgJson.engines.node;
	const m = nodeVer.match(/(\d+\.\d+\.\d+)/);
	if (!m) {
		if (nodeVer) {
			throw new Error(`Invalid Node.js engine version from appcd-core package.json: ${nodeVer}`);
		} else {
			throw new Error('Unable to determine Node.js engine version from appcd-core package.json');
		}
	}
	nodeVer = `v${m[1]}`;

	return spawnNode({
		args:     [ require.resolve('appcd-core') ].concat(args),
		detached: !debug,
		nodeHome: expandPath(cfg.get('home'), 'node'),
		version:  nodeVer,
		v8mem:    cfg.get('core.v8.memory')
	});
}
