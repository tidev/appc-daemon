import Response, { codes } from 'appcd-response';

import { createRequest, loadConfig } from './common';
import { expandPath } from 'appcd-path';

const readActions = {
	'get':     'get',
	'ls':      'get',
	'list':    'get'
};

const writeActions = {
	'set':     'set',

	'delete':  'delete',
	'rm':      'delete',
	'unset':   'delete',

	'push':    'push',
	'pop':     'pop',
	'shift':   'shift',
	'unshift': 'unshift'
};

const cmd = {
	desc: 'get and set config options',
	options: {
		'--json': { desc: 'outputs the config as JSON' }
	},
	args: [ 'action', 'key', 'value' ],
	action({ argv, _ }) {
		const cfg = loadConfig(argv);
		let [ incomingAction, key, value ] = _;

		let action = readActions[incomingAction] || writeActions[incomingAction];
		if (!action) {
			key = incomingAction;
			action = 'get';
		}

		const data = {
			action,
			key,
			value
		};

		if (writeActions[action]) {
			if (!key) {
				console.error(`Error: Missing the configuration key to ${action}`);
				process.exit(1);
			}

			try {
				data.value = JSON.parse(data.value);
			} catch (e) {
				// squelch
			}

			if ((action === 'set' || action === 'push' || action === 'unshift') && data.value === undefined) {
				console.error(`Error: Missing the configuration value to ${action}`);
				process.exit(1);
			}
		}

		const { client, request } = createRequest(cfg, '/appcd/config', data);

		request
			.once('error', async (err) => {
				if (err.code === 'ECONNREFUSED') {
					// the daemon is not running, need to do things the easy way

					if (action === 'get') {
						const filter = key && key.split(/\.|\//).join('.') || undefined;
						const value = cfg.get(filter);
						if (value === undefined) {
							printAndExit(key, value, argv.json, 6);
						} else {
							printAndExit(key, value, argv.json);
						}
					}

					// it's a write operation

					try {
						let result = true;

						switch (action) {
							case 'set':
								cfg.set(key, data.value);
								break;

							case 'delete':
								if (!cfg.delete(key)) {
									console.error(`Error: Unable to delete key "${key}"`);
									process.exit(1);
								}
								break;

							case 'push':
								cfg.push(key, data.value);
								break;

							case 'pop':
								result = cfg.pop(key);
								break;

							case 'shift':
								result = cfg.shift(key);
								break;

							case 'unshift':
								cfg.unshift(key, data.value);
								break;
						}

						const home = cfg.get('home');
						if (!home) {
							console.error('The "home" directory is not configured and the change was not saved');
							process.exit(1);
						}

						await cfg.save(expandPath(home, 'config.json'));

						printAndExit(null, argv.json ? result : 'Saved', argv.json);

					} catch (ex) {
						err = ex;
					}
				}

				printAndExit(null, argv.json ? {
					code: err.code,
					message: err.message
				} : err.toString(), argv.json, 1);
			})
			.on('response', message => {
				client.disconnect();

				let result = 'Saved';
				if (message !== 'OK') {
					result = message;
				} else if (argv.json) {
					// if a pop() or shift() returns OK, then that means there's no more items and
					// thus we have to force undefined
					result = /^pop|shift$/.test(action) ? undefined : true;
				}

				printAndExit(key, result, argv.json);
			});
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
 * @param {Number} [exitCode=0] - The exit code to return after printing the value.
 */
function printAndExit(key, value, json, exitCode = 0) {
	if (json) {
		console.log(JSON.stringify(value, null, 2));
	} else if (value && typeof value === 'object') {
		let width = 0;
		const rows = [];

		(function walk(scope, segments) {
			for (const key of Object.keys(scope)) {
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

	process.exit(exitCode);
}
