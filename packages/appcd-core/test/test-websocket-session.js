import Dispatcher from 'appcd-dispatcher';
import msgpack from 'msgpack-lite';
import snooplogg, { StdioStream } from '../src/logger';
import WebServer from 'appcd-http';
import WebSocketSession from '../src/websocket-session';

import { WebSocket } from 'appcd-http';

describe('WebSocketSession', () => {
	afterEach(function (done) {
		if (this.server) {
			this.server.close()
				.then(() => {
					this.server = null;
					done();
				})
				.catch(err => {
					done(err);
				});
		} else {
			done();
		}
	});

	it('should fail if constructor args are invalid', () => {
		expect(() => {
			new WebSocketSession();
		}).to.throw(TypeError, 'Expected a WebSocket instance');

		expect(() => {
			new WebSocketSession(null);
		}).to.throw(TypeError, 'Expected a WebSocket instance');

		expect(() => {
			new WebSocketSession({});
		}).to.throw(TypeError, 'Expected a WebSocket instance');

		expect(() => {
			const ws = new WebSocket('ws://127.0.0.1:1337');
			new WebSocketSession(ws, function () {});
		}).to.throw(TypeError, 'Expected a Dispatcher instance');

		expect(() => {
			const ws = new WebSocket('ws://127.0.0.1:1337');
			new WebSocketSession(ws, {});
		}).to.throw(TypeError, 'Expected a Dispatcher instance');
	});

	it('should dispatch WebSocket request', function (done) {
		this.server = new WebServer({
			hostname: '127.0.0.1',
			port:     1337
		});

		const dispatcher = new Dispatcher;
		let uuid = 0;

		dispatcher.register('/foo', ctx => {
			ctx.response = 'bar!';
		});

		this.server
			.on('websocket', ws => new WebSocketSession(ws, dispatcher))
			.listen()
			.then(() => {
				// call the websocket
				const socket = new WebSocket('ws://127.0.0.1:1337');

				socket.on('message', (msg, flags) => {
					if (flags.binary) {
						msg = msgpack.decode(msg);
					} else if (typeof msg === 'string') {
						try {
							msg = JSON.parse(msg);
						} catch (e) {}
					}

					try {
						expect(msg).to.be.an.Object;
						expect(msg.status).to.equal(200);
						expect(msg.message).to.equal('bar!');
						done();
					} catch (e) {
						done(e);
					}
				});

				socket.on('open', () => {
					socket.send(JSON.stringify({
						data: 'foo',
						id: uuid++,
						path: '/foo',
						version: '1.0'
					}));
				});
			})
			.catch(done);
	});
});
