import Client from './client';
import Server from './server';
import Service from './service';
import { version } from '../package.json';

/** @external {EventEmitter} https://nodejs.org/api/events.html#events_class_events_eventemitter */
/** @external {Writable} https://nodejs.org/api/stream.html#stream_class_stream_writable */

export {
	version,
	Client,
	Server,
	Service
};
