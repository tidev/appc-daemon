import debug from 'debug';
import fs from 'fs';

import { expandPath } from 'appcd-path';
import { spawnNode } from 'appcd-nodejs';
import * as init from './init';

const log = debug('appcd:start');

const cmd = {
	options: {
		'--config <json>':      { type: 'json', desc: 'serialized JSON string to mix into the appcd config' },
		'--config-file <file>': { type: 'file', desc: 'path to a appcd JS config file' },
		'--debug':              { desc: 'don\'t run as a background daemon' }
	},
	action: ({ argv }) => {
		const { config, configFile, debug } = argv;
		const cfg = init.config({ config, configFile });

		// find the appcd core
		const corePkgJson = JSON.parse(fs.readFileSync(require.resolve('appcd-core/package.json'), 'utf8'));
		let nodeVer = corePkgJson.engines.node.match(/(\d+\.\d+\.\d+)/);
		if (!nodeVer) {
			throw new Error('Unable to determine Node.js engine version from appcd-core package.json');
		}
		nodeVer = `v${nodeVer[1]}`;

		return spawnNode({
			args:     [ require.resolve('appcd-core') ],
			detached: !debug,
			nodeHome: expandPath(cfg.get('home'), 'node'),
			version:  nodeVer,
			v8mem:    cfg.get('core.v8.memory')
		});
	}
};

export default cmd;
