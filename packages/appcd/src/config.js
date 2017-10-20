import { createInstanceWithDefaults, StdioStream } from 'appcd-logger';
import { banner, createRequest, loadConfig } from './common';

const logger = createInstanceWithDefaults().config({ theme: 'compact' }).enable('*').pipe(new StdioStream());
const { log, error } = logger;
const { alert, highlight, note, underline } = logger.styles;

const cmd = {
	options: {
		'--json': { desc: 'outputs the config as JSON' }
	},
	action({ argv, _ }) {
		const cfg = loadConfig(argv);
		const [ action, key, value ] = _;
		const data = {
			action,
			key,
			value: convertValue(value)
		};
		const { client, request } = createRequest(cfg, '/appcd/config', data);

		request
			.once('error', err => {
				const { code, errorCode } = err;
				if (err.code === 'ECONNREFUSED') {
					switch (action) {
						case 'set':
							if (!key) {
								log('Not allowed to set config root');
								return;
							}
							try {
								cfg.set(key, value);
								log(`Set ${underline(key)} to ${highlight(value)}`);
							} catch (ex) {
								log(`Oh no! Couldn't set ${key}`);
							}
							return;

						case 'rm':
						case 'delete':
							if (!key) {
								log('Not allowed to delete config root');
								return;
							}
							try {
								cfg.delete(key);
								logIt(action, key, value);
							} catch (ex) {
								console.log(ex);
								error(`Unable to remove property ${key}`);
							}
							return;

						case 'push':
							if (!key) {
								log('Not allowed to push onto config root');
								return;
							}
							try {
								logIt(action, key, value);
							} catch (e) {
								log(e);
								log(`Oh no! Couldn't push ${key}`);
							}
							return;

						case 'shift':
							if (!key) {
								log('Not allowed to shift config root');
								return;
							}
							try {
								logIt(action, key, value);
							} catch (e) {
								log(`Oh no! Couldn't shift ${key}`);
							}
							return;

						case 'pop':
							if (!key) {
								log('Not allowed to pop config root');
								return;
							}
							try {
								const val = cfg.pop(key);
								console.log(val);
								logIt(action, key, value);
							} catch (e) {
								console.log(e);
								log(`Oh no! Couldn't pop ${key}`);
							}
							return;

						case 'unshift':
							if (!key) {
								log('Not allowed to unshift onto config root');
								return;
							}
							try {
								cfg.unshift(key, data.value);
								logIt(action, key, value);
							} catch (e) {
								log(`Oh no! Couldn't unshift ${key}`);
							}
							return;

						case 'ls':
						case 'get':
						case 'list':
						case undefined:
							break;

						default:
							error(`Invalid action: ${action}`);
							return;
					}
					const filter = key && key.split(/\.|\//).join('.') || undefined;
					const node = cfg.get(filter || undefined);
					if (!node) {
						log(`Not Found: ${filter || ''}`);
						process.exit(1);
					}
					log(prettyConfig(node));
				}  else if (err.errorCode === 400) {
					if (argv.json) {
						log(err);
					} else {
						error(`Invalid action ${alert(underline(action))}`);
					}
				} else if (err.errorCode === 404) {
					if (argv.json) {
						log(err);
					} else {
						error(`Unable to find key ${key}`);
					}
				} else if (err.errorCode === 500) {
					if (argv.json) {
						log(err);
					} else {
						error(`Unable to set readonly property ${key}`);
					}
					process.exit(6);
				} else {
					log(err);
				}
				process.exit(1);
			})
			.on('response', (message, response) => {
				client.disconnect();
				if (argv.json) {
					log(response);
					process.exit(0);
				}
				log(banner());
				if (argv.json) {
					log(message);
				} else {
					logIt(action, key, value, false, message);
				}
				process.exit(0);
			});
	}
};

function logIt(action, key, value, json = false, message) {
	switch (action) {
		case 'push':
		case 'unshift':
			if (json) {
				log({});
			} else {
				log(`Added ${highlight(value)} to ${underline(key)}`);
			}
			break;
		case 'set':
			if (json) {
				log({});
			} else {
				log(`Set ${underline(key)} to ${highlight(value)}`);
			}
			break;
		case 'rm':
		case 'delete':
			if (json) {
				log({});
			} else {
				log(`Removed ${underline(key)}`);
			}
			break;
		case 'pop':
		case 'shift':
			if (json) {
				log({});
			} else {
				log(`Removed value from ${underline(key)}`);
			}
			break;
		case 'ls':
		case 'list':
		case 'get':
		default:
			log(prettyConfig(message, key));
			break;
	}
}

function prettyConfig (config, key) {
	const results = {};
	function walk(obj, parts, parent) {
		var filter = Array.isArray(parts) ? parts.shift() : null;
		Object.keys(obj).forEach(function (name) {
			if (!filter || name === filter) {
				var p = parent ? parent + '.' + name : name;
				if (Object.prototype.toString.call(obj[name]) === '[object Object]') {
					walk(obj[name], parts, p);
				} else if (!parts || !parts.length || !parent || parent.indexOf(parts) === 0) {
					if (obj[name]) {
						results[p] = JSON.stringify(obj[name]);
					}
				}
			}
		});
	}
	if (typeof config === 'object' && !Array.isArray(config)) {
		walk(config);
	} else {
		results[key] = config;
	}
	var maxlen = Object.keys(results).reduce(function (a, b) {
		return Math.max(a, b.length + 1);
	}, 0);
	let string = '';
	Object.keys(results).sort().forEach(function (k) {
		const padding = maxlen - k.length;
		let value;
		string += `${underline(k)} ${('=').padStart(padding)} ${highlight((results[k]))}\n`;
	});
	return string;
}

function convertValue(value) {
	if (typeof value === 'object') {
		return JSON.parse(value);
	} else {
		return value;
	}
}

export default cmd;
