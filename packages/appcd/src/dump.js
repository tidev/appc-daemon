import fs from 'fs';
import path from 'path';

import { createRequest, loadConfig } from './common';
import { createInstanceWithDefaults, StdioStream } from 'appcd-logger';
import { debounce } from 'appcd-util';

const { log } = createInstanceWithDefaults().config({ theme: 'compact' }).enable('*').pipe(new StdioStream());

const cmd = {
	desc: 'dumps the config, status, health, and debug logs to a file',
	args: [
		{ name: 'file', desc: 'the file to dump the info to, otherwise stdout' },
	],
	action({ argv, _ }) {
		const cfg = loadConfig(argv);
		const results = {
			config: {},
			status: {},
			health: [],
			log: []
		};
		let [ file ] = _;

		return Promise.resolve()
			// get the logs first to avoid noise from getting the config, status, and health
			.then(() => new Promise(resolve => {
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
					.once('error', () => resolve());
			}))
			.then(() => Promise.all([
				new Promise(resolve => {
					const { client, request } = createRequest(cfg, '/appcd/config');
					request
						.on('response', config => {
							client.disconnect();
							results.config = config;
							resolve();
						})
						.once('error', () => {
							results.config = cfg;
							resolve();
						});
				}),

				new Promise(resolve => {
					const { client, request } = createRequest(cfg, '/appcd/health');
					request
						.on('response', health => {
							client.disconnect();
							results.health = health;
							resolve();
						})
						.once('error', () => resolve());
				}),

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
				})
			]))
			.then(() => results)
			.catch(err => err)
			.then(results => {
				if (file) {
					file = path.resolve(file);
					fs.writeFileSync(file, JSON.stringify(results, null, 2));
					log(`Wrote dump to ${file}`);
				} else {
					log(JSON.stringify(results, null, 2));
				}
			});
	}
};

export default cmd;
