import fs from 'fs';
import path from 'path';

import { createRequest, loadConfig } from './common';
import { debounce } from 'appcd-util';

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
					.on('response', (message, response) => {
						results.log.push({
							args:      response.args,
							typeStyle: response.typeStyle,
							typeLabel: response.typeLabel,
							ns:        response.ns,
							nsStyle:   response.nsStyle,
							ts:        response.ts
						});
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
					console.log(`Wrote dump to ${file}`);
				} else {
					console.log(JSON.stringify(results, null, 2));
				}
			});
	}
};

export default cmd;
