import { GawkObject } from 'gawk';

const modules = {
	android: require('androidlib'),
	ios:     process.platform === 'darwin' && require('ioslib'),
	jdklib:  require('jdklib'),
	windows: /^win/.test(process.platform) && require('windowslib')
};

export default class SystemInfoService extends appcd.Service {
	/**
	 *
	 * @type {GawkObject}
	 */
	data = new GawkObject;

	/**
	 * A map of all active library watchers.
	 * @type {Object}
	 */
	watchers = {};

	constructor() {
		// temporary hack for https://phabricator.babeljs.io/T7309
		super();
	}

	/**
	 * Initializes the system info plugin.
	 */
	init() {
		const handler = ctx => {
			const filter = ctx.params.filter && ctx.params.filter.replace(/^\//, '').split('/') || undefined;
			const node = this.data.get(filter);
			if (!node) {
				throw new Error('Invalid request: ' + ctx.path);
			}

			if (ctx.conn) {
				ctx.conn.write(node.toJSON(true));

				if (ctx.data.continuous) {
					const off = node.watch(evt => ctx.conn.write(evt.source.toJSON(true)));
					ctx.conn.on('close', off);
					ctx.conn.on('error', off);
				} else {
					ctx.conn.close();
				}
			} else {
				ctx.body = node.toJSON(true);
			}
		};

		this.register('/:filter*', handler);
		this.router.get('/:filter*', handler);

		return Promise.all(Object.entries(modules).map(([name, module]) => {
			if (module) {
				const node = this.data.set(name, {});
				this.watchers[name] = module
					.watch({})
					.on('results', results => {
						node.mergeDeep(results);
					});
					// .then(watcher => {
					// 	this.watchers[name] = watcher;
					// 	watcher.listen(results => {
					//
					// 	});
					// });
			}
		}));
	}

	/**
	 * Shuts down the system info plugin.
	 */
	shutdown() {
		for (const stop of Object.values(this.watchers)) {
			stop();
		}
		this.watchers = {};
	}
}
