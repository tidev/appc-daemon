import { createRequest, loadConfig } from './common';

const cmd = {
	action({ argv, _ }) {
		const cfg = loadConfig(argv);
		const [ action, key, value ] = _;
		let data = {
			action,
			key,
			value
		};
		createRequest(cfg, '/appcd/config', data, argv.subscribe ? 'subscribe' : undefined)
			.request
			.on('response', (message, response) => {
				if (!argv.subscribe) {
					console.log(message);
					process.exit(0);
				}

				if (response.type === 'publish') {
					console.log(message);
				}
			})
			.on('error', err => {
				if (err.code === 'ECONNREFUSED') {
					switch (action) {
						case 'get':
							break;

						case 'set':
							if (!key) {
								console.log('Not allowed to set config root');
								return;
							}
							try {
								cfg.set(key, value);
								console.log(`Succesfully set ${key} to ${value}`);
							} catch (ex) {
								console.log(`Oh no! Couldn't set ${key}`);
							}
							return;

						case 'delete':
							if (!key) {
								console.log('Not allowed to delete config root');
								return;
							}
							try {
								cfg.delete(key);
								console.log('I hope you didn\'t need that. Deleted!');
							} catch (ex) {
								console.log('Sorry Dave, I\'m afraid I can\'t let you do that');
							}
							return;

						case 'list':
						case undefined:
							break;

						default:
							console.error(`Invalid action: ${action}`);
							return;
					}
					const filter = key && key.split(/\.|\//).join('.') || undefined;
					const node = cfg.get(filter || undefined);
					if (!node) {
						console.log(`Not Found: ${filter || ''}`);
						process.exit(1);
					}
					console.log(node);
					process.exit(0);
				}
				process.exit(1);
			});
	}
};

export default cmd;
