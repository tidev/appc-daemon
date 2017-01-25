import Config from 'appcd-config';
import debug from 'debug';
import fs from 'fs';
import path from 'path';

import { isFile } from 'appcd-fs';
import { arch } from 'appcd-util';
import { spawnNode } from 'appcd-nodejs';

const log = debug('appcd:start');

const cmd = {
	options: {
		'--config <json>':      { type: 'json', desc: 'serialized JSON string to mix into the appcd config' },
		'--config-file <file>': { type: 'file', desc: 'path to a appcd JS config file' },
		'--debug':              { desc: 'don\'t run as a background daemon' }
	},
	action: ({ argv }) => {
		const { config, configFile, debug } = argv;
		const confPath = path.resolve(__dirname, '../../conf');
		const cfg = new Config({ config, configFile: path.join(confPath, 'default.js') });
		isFile(configFile) && cfg.load(configFile);

		let env = cfg.environment && cfg.environment.name || cfg.environment || 'preprod';
		let remerge = false;

		const cfgPaths = [
			path.resolve(confPath, `${env}.js`),
			path.resolve(confPath, `${env}.json`),
			configFile && path.join(path.dirname(configFile), `${env}.js`),
			configFile && path.join(path.dirname(configFile), `${env}.json`)
		];
		for (const file of cfgPaths) {
			if (isFile(file)) {
				remerge = true;
				cfg.load(file);
			}
		}

		if (remerge && config) {
			cfg.merge(config);
		}


		// const corePath = path.resolve(__dirname, '../node_modules/appcd-core');
		// const corePkgJson = JSON.parse(fs.readFileSync(path.join(corePath, 'package.json')));
		// const coreMain = path.resolve(corePath, corePkgJson.main);
		//
		// console.log(require.resolve('appcd-core/package.json'));

		// let nodeVer = corePkgJson.engines.node;
		// if (!/^v/.test(nodeVer)) {
		// 	nodeVer = `v${nodeVer}`;
		// }
		//
		// if (!debug) {
		// 	return spawnNode({
		// 		version: nodeVer,
		// 		// arch: corePkgJson.arch?????
		// 		args: [coreMain],
		// 		detached: true
		// 	});
		// }
		//
		// if (process.version !== nodeVer) {
		// 	throw new Error(`You must run appcd using Node.js ${nodeVer} when using --debug`);
		// }
		//
		// require(coreMain);
	}
};

export default cmd;
