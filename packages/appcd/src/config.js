import { createRequest, loadConfig } from './common';
import { expandPath } from 'appcd-path';

const readActions = {
	get:     'get',
	ls:      'get',
	list:    'get'
};

const writeActions = {
	set:     'set',

	delete:  'delete',
	rm:      'delete',
	unset:   'delete',

	push:    'push',
	pop:     'pop',
	shift:   'shift',
	unshift: 'unshift'
};

const cmd = {
	desc: 'get and set config options',
	options: {
		'--json': { desc: 'outputs the config as JSON' }
	},
	args: [ 'action', 'key', 'value' ],
	async action({ argv }) {
		const cfg = loadConfig(argv);
		let { action, key, value } = argv;

		if (!readActions[action] && !writeActions[action]) {
			key = action;
			action = 'get';
		}

		const data = {
			action,
			key,
			value
		};

		try {
			if (writeActions[action]) {
				if (!key) {
					throw new Error(`Missing the configuration key to ${action}`);
				}

				try {
					data.value = JSON.parse(data.value);
				} catch (e) {
					// squelch
				}

				if ((action === 'set' || action === 'push' || action === 'unshift') && data.value === undefined) {
					throw new Error(`Missing the configuration value to ${action}`);
				}
			}

			const { client, request } = createRequest(cfg, '/appcd/config', data);

			await new Promise((resolve, reject) => {
				request
					.once('error', async (err) => {
						if (err.code === 'ECONNREFUSED') {
							// the daemon is not running, need to do things the easy way

							if (action === 'get') {
								const filter = key && key.split(/\.|\//).join('.') || undefined;
								const value = cfg.get(filter);
								if (value === undefined) {
									const e = new Error(`Not Found: ${key}`);
									e.exitCode = 6;
									return reject(e);
								}

								print(key, value, argv.json);
								resolve();
								return;
							}

							// it's a write operation

							try {
								let result = 'Saved';
								let value;

								switch (action) {
									case 'set':
										cfg.set(key, data.value);
										break;

									case 'delete':
										if (!cfg.has(key)) {
											const e = new Error(`Not Found: ${key}`);
											e.exitCode = 6;
											return reject(e);
										}

										if (!cfg.delete(key)) {
											return reject(new Error(`Unable to delete key "${key}"`));
										}
										break;

									case 'push':
										cfg.push(key, data.value);
										result = cfg.get(key);
										if (!argv.json) {
											result = JSON.stringify(result);
										}
										break;

									case 'pop':
										if (!cfg.has(key)) {
											const e = new Error(`Not Found: ${key}`);
											e.exitCode = 6;
											return reject(e);
										}

										value = cfg.pop(key);
										result = value || (argv.json ? null : '<empty>');
										break;

									case 'shift':
										if (!cfg.has(key)) {
											const e = new Error(`Not Found: ${key}`);
											e.exitCode = 6;
											return reject(e);
										}

										value = cfg.shift(key);
										result = value || (argv.json ? null : '<empty>');
										break;

									case 'unshift':
										cfg.unshift(key, data.value);
										result = cfg.get(key);
										if (!argv.json) {
											result = JSON.stringify(result);
										}
										break;
								}

								const home = cfg.get('home');
								if (!home) {
									return reject(new Error('The "home" directory is not configured and the change was not saved'));
								}

								await cfg.save(expandPath(home, 'config.json'));

								print(null, result, argv.json);
								return resolve();

							} catch (ex) {
								err = ex;
							}
						}

						reject(err);
					})
					.on('response', message => {
						client.disconnect();

						let result = 'Saved';
						if (message !== 'OK') {
							result = message;
						} else if (argv.json) {
							// if a pop() or shift() returns OK, then that means there's no more items and
							// thus we have to force undefined
							if (/^pop|shift$/.test(action)) {
								result = '';
							}
						}

						print(key, result, argv.json);
						resolve();
					});
			});
		} catch (e) {
			if (argv.json) {
				this.showHelpOnError = false;
				e.json = argv.json;
			}
			throw e;
		}
	}
};

export default cmd;

/**
 * Prints the result.
 *
 * @param {String?} key - The prefix used for the filter to prepend the keys when listing the config
 * settings.
 * @param {*} value - The resulting value.
 * @param {Boolean} [json=false] - When `true`, displays the output as json.
 */
function print(key, value, json) {
	if (json) {
		console.log(JSON.stringify({
			code: 0,
			result: value
		}, null, 2));
	} else if (value && typeof value === 'object') {
		let width = 0;
		const rows = [];

		(function walk(scope, segments) {
			for (const key of Object.keys(scope).sort()) {
				segments.push(key);
				if (scope[key] && typeof scope[key] === 'object') {
					walk(scope[key], segments);
				} else {
					const path = segments.join('.');
					width = Math.max(width, path.length);
					rows.push([ path, scope[key] ]);
				}
				segments.pop();
			}
		}(value, key ? key.split('.') : []));

		for (const row of rows) {
			console.log(row[0].padEnd(width) + ' = ' + row[1]);
		}
	} else {
		console.log(value);
	}
}
