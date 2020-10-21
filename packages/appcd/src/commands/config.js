export default {
	aliases: '!conf',
	commands: {
		'@ls, list': {
			desc: 'Display all config settings',
			action: ctx => runConfig('get', ctx)
		},
		'get [key]': {
			desc: 'Display a specific config setting',
			action: ctx => runConfig('get', ctx)
		},
		'set <key> <value>': {
			desc: 'Change a config setting',
			action: ctx => runConfig('set', ctx)
		},
		'@rm, delete, !remove, !unset <key>': {
			desc: 'Remove a config setting',
			action: ctx => runConfig('delete', ctx)
		},
		'push <key> <value>': {
			desc: 'Add a value to the end of a list',
			action: ctx => runConfig('push', ctx)
		},
		'pop <key>': {
			desc: 'Remove the last value in a list',
			action: ctx => runConfig('pop', ctx)
		},
		'shift <key>': {
			desc: 'Remove the first value in a list',
			action: ctx => runConfig('shift', ctx)
		},
		'unshift <key> <value>': {
			desc: 'Add a value ot the beginning of a list',
			action: ctx => runConfig('unshift', ctx)
		}
	},
	desc: 'Manage configuration options',
	help: {
		header() {
			return `${this.desc}.

When setting a config setting and the Appc Daemon is running, settings will be both saved to disk and applied at runtime without needing to restart the daemon.`;
		},
		footer: ({ style }) => `${style.heading('Examples:')}

  List all config settings:
    ${style.highlight('appcd config ls')}

  Return the config as JSON:
    ${style.highlight('appcd config ls --json')}

  Get a specific config setting:
    ${style.highlight('appcd config get home')}

  Set a config setting:
    ${style.highlight('appcd config set telemetry.enabled true')}`
	},
	options: {
		'--json': 'Outputs the config as JSON'
	}
};

async function runConfig(action, { argv, cmd, console, setExitCode }) {
	const [
		{ default: appcdLogger },
		{ createRequest, loadConfig }
	] = await Promise.all([
		import('appcd-logger'),
		import('../common')
	]);

	const { log } = appcdLogger('appcd:config');
	let { json, key, value } = argv;
	const cfg = loadConfig(argv);
	const data = { action, key, value };
	const filter = key && key.split(/\.|\//).filter(Boolean).join('.') || undefined;

	if (typeof data.value === 'string') {
		try {
			data.value = JSON.parse(data.value);
		} catch (e) {
			// squelch
		}
	}

	const print = ({ code = 0, key = null, value }) => {
		setExitCode(code);
		cmd.banner = false;

		if (json) {
			console.log(JSON.stringify(value, null, 2));
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
	};

	try {
		const { client, request } = createRequest(cfg, '/appcd/config', data);

		await new Promise((resolve, reject) => {
			request
				.once('error', async (err) => {
					client.disconnect();

					if (err.code === 'ECONNREFUSED') {
						// the daemon is not running, need to do things the easy way

						log('Daemon is not running, using local config file');
						log(`action = ${action}`);

						try {
							if (action === 'get') {
								const value = cfg.get(filter);
								print({ code: value === undefined ? 6 : 0, key: filter || key, value });
								return resolve();
							}

							// it's a write operation
							let result = 'OK';

							switch (action) {
								case 'set':
									cfg.set(key, data.value);
									break;

								case 'delete':
									cfg.delete(key);
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

							cfg.save();

							print({ value: result });
							return resolve();

						} catch (ex) {
							err = ex;
						}
					}

					if (action === 'get' && err.status === 404) {
						print({ code: 6, key });
						return resolve();
					}

					reject(err);
				})
				.on('response', async value => {
					client.disconnect();
					print({ key: filter || key, value });
					resolve();
				});
		});
	} catch (err) {
		err.json = json;
		throw err;
	}
}
