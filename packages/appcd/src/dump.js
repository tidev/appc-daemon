import fs from 'fs';
import path from 'path';

import { createRequest, loadConfig } from './common';
import { createInstanceWithDefaults, StdioStream } from 'appcd-logger';
import { debounce } from 'appcd-util';

const { log } = createInstanceWithDefaults().config({ theme: 'compact' }).enable('*').pipe(new StdioStream());

const cmd = {
	desc: 'dumps the Appc Daemon\'s config, status, and logs to a file',
	args: [
		{ name: 'file', desc: 'the file to dump the info to, otherwise stdout' },
	],
	async action({ argv, _ }) {
		const cfg = loadConfig(argv);
		const results = {
			config: cfg,
			status: {},
			log: []
		};
		let [ file ] = _;

		if (file) {
			file = path.resolve(file);
		}

		await Promise.all([
			new Promise(resolve => {
				const { client, request } = createRequest(cfg, '/appcd/status');
				request
					.on('response', status => {
						client.disconnect();
						results.status = status;
						resolve();
					})
					.once('error', err => {
						results.status = err;
						resolve();
					});
			}),

			new Promise(resolve => {
				const { client, request } = createRequest(cfg, '/appcd/logcat', { colors: false });
				const done = debounce(() => {
					client.disconnect();
					resolve();
				});

				request
					.on('response', response => {
						results.log.push(response);
						done();
					})
					.once('error', () => {
						resolve();
					});
			})
		]);

		if (file) {
			fs.writeFileSync(file, JSON.stringify(results, null, '  '));
			log(`Wrote dump to ${file}`);
		} else {
			log(JSON.stringify(results, null, '  '));
		}
	}
};

export default cmd;
