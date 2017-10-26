import Response, { codes } from 'appcd-response';

import { banner, createRequest, loadConfig } from './common';

const cmd = {
	desc: 'get and set config options',
	options: {
		'--json': { desc: 'outputs the config as JSON' }
	},
	args: [ 'action', 'key', 'value' ],
	action({ argv, _ }) {
		const cfg = loadConfig(argv);
		const [ action, key, value ] = _;
		const data = {
			action,
			key,
			value
		};

		try {
			data.value = JSON.parse(data.value);
		} catch (e) {
			// squelch
		}

		const { client, request } = createRequest(cfg, '/appcd/config', data);

		request
			.once('error', async (err) => {
				// let config;
				// let val;
				// let response;

				if (err.code === 'ECONNREFUSED') {
					try {
						if (/^set|delete|rm|unset|push|pop|shift|unshift$/.test(action) && !key) {
							throw new Error(`${action} requires a config key modify`);
						}

						// switch (action) {
						// 	case 'set':
						// 		cfg.set(key, value);
						// 		break;
						//
						// 	case 'rm':
						// 	case 'unset':
						// 	case 'delete':
						// 		cfg.delete(key);
						// 		break;
						//
						// 	case 'push':
						// 		cfg.push(key, value);
						// 		break;
						//
						// 	case 'shift':
						// 		cfg.shift(key);
						// 		break;
						//
						// 	case 'pop':
						// 		val = cfg.pop(key);
						// 		break;
						//
						// 	case 'unshift':
						// 		cfg.unshift(key, value);
						// 		break;
						//
						// 	case 'ls':
						// 	case 'get':
						// 	case 'list':
						// 	case undefined:
						// 		const filter = key && key.split(/\.|\//).join('.') || undefined;
						// 		config = cfg.get(filter || undefined);
						// 		if (!config) {
						// 			response = new Response(codes.NOT_FOUND, `Not found: ${filter || ''}`);
						// 		}
						// 		break;
						//
						// 	default:
						// 		response = new Response(codes.BAD_REQUEST, `Invalid action: ${action}`);
						// }
					} catch (ex) {
						// response = ex;
						// logIt({ response });
					}

					// if (argv.json) {
					// 	log(response || config);
					// } else {
					// 	logIt({ action, key, value, config, response });
					// }

				} else {
					if (argv.json) {
						console.log(JSON.stringify({
							code: err.errorCode,
							message: err.message,
							stack: err.stack
						}, null, 2));
					} else {
						console.log(err.toString());
					}
					process.exit(1);
				}
			})
			.on('response', message => {
				client.disconnect();

				if (argv.json) {
					console.log(message);
				} else {
					print(message);
				}

				process.exit(0);
			});
	}
};

export default cmd;

function print(message) {
	console.log(banner());

	if (message && typeof message === 'object') {
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
		}(message, []));

		for (const row of rows) {
			console.log(row[0].padEnd(width) + ' = ' + row[1]);
		}
	} else {
		console.log(message.code === 200 ? 'Saved' : message);
	}
}

/*
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
			log(`Added ${value} to ${key}`);
			break;
		case 'set':
			log(`Set ${key} to ${value}`);
			break;
		case 'rm':
		case 'delete':
			log(`Removed ${key}`);
			break;
		case 'pop':
		case 'shift':
			log(`Removed value from ${key}`);
			break;
		case 'ls':
		case 'list':
		case 'get':
		default:
			log(prettyConfig(config, key));
			break;
	}
}

function prettyConfig(config, key) {
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
		return `${key} = ${config}`;
	}
	const maxlen = Object.keys(results).reduce(function (a, b) {
		return Math.max(a, b.length + 1);
	}, 0);
	let string = '';
	Object.keys(results).sort().forEach(function (k) {
		const padding = maxlen - k.length;
		string += `${k} ${('=').padStart(padding)} ${results[k]}\n`;
	});
	return string;
}
*/
