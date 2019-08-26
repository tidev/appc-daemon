const readActions = {
	get:     'get',
	ls:      'get',
	list:    'get'
};

const writeActions = {
	set:     'set',

	delete:  'delete',
	remove:  'delete',
	rm:      'delete',
	unset:   'delete',

	push:    'push',
	pop:     'pop',
	shift:   'shift',
	unshift: 'unshift'
};

export default {
	aliases: 'conf',
	args: [
		{
			name: '<action>',
			desc: 'the action to run',
			values: {
				'ls, list': 'display all settings',
				get: 'display a specific setting',
				set: 'change a setting',
				'rm, delete': 'remove a setting',
				push: 'add a value to the end of a list',
				pop: 'remove the last value in a list'
			}
		},
		{ name: 'key', desc: '' },
		{ name: 'value', desc: '' }
	],
	desc: 'get and set config options',
	options: {
		'--json': 'outputs the config as JSON'
	},
	async action({ argv }) {
		const [
			{ default: appcdLogger },
			{ expandPath },
			{ createRequest, loadConfig }
		] = await Promise.all([
			import('appcd-logger'),
			import('appcd-path'),
			import('../common')
		]);

		const { log } = appcdLogger('appcd:config');

		let { action, key, value } = argv;

		if (!readActions[action] && !writeActions[action]) {
			throw new Error(`Unknown action: ${action}`);
		}

		const cfg = loadConfig(argv);
		const data = {
			action: readActions[action] || writeActions[action] || action,
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
						client.disconnect();

						// in general, we do not want to show the help screen for the errors below
						// since they are valid messages and we're just using errors for flow control
						this.showHelpOnError = false;

						if (err.code === 'ECONNREFUSED') {
							// the daemon is not running, need to do things the easy way

							log('Daemon is not running, using local config file');

							if (readActions[action]) {
								const filter = key && key.split(/\.|\//).join('.') || undefined;
								const value = cfg.get(filter);
								if (value === undefined) {
									const e = new Error(`Not Found: ${key}`);
									e.exitCode = 6;
									return reject(e);
								}

								await print({ key, value, json: argv.json });
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

								await print({ value: result, json: argv.json });
								return resolve();

							} catch (ex) {
								err = ex;
							}
						}

						reject(err);
					})
					.on('response', async message => {
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

						await print({ key, value: result, json: argv.json });
						resolve();
					});
			});
		} catch (err) {
			if (argv.json) {
				this.showHelpOnError = false;
				err.json = argv.json;
			}
			throw err;
		}
	}
};

/**
 * Prints the result.
 *
 * @param {Object} opts - Various options.
 * @param {Boolean} [opts.json=false] - When `true`, displays the output as json.
 * @param {String} [opts.key=null] - The prefix used for the filter to prepend the keys when
 * listing the config settings.
 * @param {*} opts.value - The resulting value.
 */
async function print({ key = null, value, json }) {
	if (json) {
		console.log(JSON.stringify({
			code: 0,
			result: value
		}, null, 2));
	} else if (value && typeof value === 'object') {
		let width = 0;
		const rows = [];

		(function walk(scope, segments) {
			if (Array.isArray(scope) && !scope.length) {
				const path = segments.join('.');
				width = Math.max(width, path.length);
				rows.push([ path, '[]' ]);
				return;
			}

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

		if (rows.length) {
			for (const row of rows) {
				console.log(`${row[0].padEnd(width)} = ${row[1]}`);
			}
		} else {
			console.log('No config settings found');
		}
	} else {
		console.log(value);
	}
}
