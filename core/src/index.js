import { version } from '../package.json';

/** @external {EventEmitter} https://nodejs.org/api/events.html#events_class_events_eventemitter */
/** @external {Writable} https://nodejs.org/api/stream.html#stream_class_stream_writable */

export const api = {
	version
};

const modules = {
	Client:  './client',
	Server:  './server',
	Service: './service'
};

for (const name of Object.keys(modules)) {
	Object.defineProperty(api, name, {
		enumerable: true,
		configurable: true,
		get: () => {
			const module = require(modules[name]);
			Object.defineProperty(api, name, { enumerable: true, value: module });
			return module;
		}
	});
}

export default api;
