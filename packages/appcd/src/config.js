import { createInstanceWithDefaults, StdioStream } from 'appcd-logger';
import Response, { codes } from 'appcd-response';
import { banner, createRequest, loadConfig } from './common';

const logger = createInstanceWithDefaults().config({ theme: 'compact' }).enable('*').pipe(new StdioStream());
const { log } = logger;
const { highlight, underline } = logger.styles;

const getterActions = [ 'ls', 'list', 'get' ];
const setterActions = [ 'set', 'rm', 'delete', 'push', 'pop', 'shift', 'unshift' ];
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
				let config;
				let val;
				let response = {};
				if (code === 'ECONNREFUSED') {
					try {
						if (setterActions.includes(action) && !key) {
							response = new Response(codes.FORBIDDEN, `Not allowed to ${action} config root`);
							logIt({ response });
							process.exit(1);
						}
						switch (action) {
							case 'set':
								cfg.set(key, value);
								break;

							case 'rm':
							case 'delete':
								cfg.delete(key);
								break;

							case 'push':
								cfg.push(key, value);
								break;

							case 'shift':
								cfg.shift(key);
								break;

							case 'pop':
								val = cfg.pop(key);
								break;

							case 'unshift':
								cfg.unshift(key, value);
								break;

							case 'ls':
							case 'get':
							case 'list':
							case undefined:
								const filter = key && key.split(/\.|\//).join('.') || undefined;
								config = cfg.get(filter || undefined);
								break;

							default:
								response = new Response(codes.BAD_REQUEST, `Invalid action: ${data.action}`);
						}
					} catch (ex) {
						response = ex;
						logIt({ response });
					}
					if (argv.json) {
						log(response);
					} else {
						logIt({ action, key, value, config });
					}
				}  else if (argv.json) {
					log(err);
				} else {
					logIt({ response: err });
				}
				process.exit(1);
			})
			.on('response', message => {
				client.disconnect();
				if (argv.json) {
					log(message);
					process.exit(0);
				}
				logIt({ action, key, value, config: message });
				process.exit(0);
			});
	}
};

function logIt({ action, key, value, config, response }) {
	log(banner());
	if (response) {
		log(response.format || response.message);
		if (response.errorCode === 500) {
			process.exit(6);
		}
		process.exit(1);
	}
	switch (action) {
		case 'push':
		case 'unshift':
			log(`Added ${highlight(value)} to ${underline(key)}`);
			break;
		case 'set':
			log(`Set ${underline(key)} to ${highlight(value)}`);
			break;
		case 'rm':
		case 'delete':
			log(`Removed ${underline(key)}`);
			break;
		case 'pop':
		case 'shift':
			log(`Removed value from ${underline(key)}`);
			break;
		case 'ls':
		case 'list':
		case 'get':
		default:
			log(prettyConfig(config, key));
			break;
	}
}

function prettyConfig (config, key) {
	const results = {};
	function walk(obj, parent) {
		Object.keys(obj).forEach(function (name) {
			const p = parent ? parent + '.' + name : name;
			if (Object.prototype.toString.call(obj[name]) === '[object Object]') {
				walk(obj[name], p);
			} else if (obj[name]) {
				results[p] = JSON.stringify(obj[name]);
			}
		});
	}

	if (typeof config === 'object' && !Array.isArray(config)) {
		walk(config, key && key.split('.'));
	} else {
		// We have just a single value, return it;
		return `${underline(key)} = ${highlight(config)}`;
	}
	const maxlen = Object.keys(results).reduce(function (a, b) {
		return Math.max(a, b.length + 1);
	}, 0);
	let string = '';
	Object.keys(results).sort().forEach(function (k) {
		const padding = maxlen - k.length;
		string += `${underline(k)} ${('=').padStart(padding)} ${highlight(results[k])}\n`;
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
