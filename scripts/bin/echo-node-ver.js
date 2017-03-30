#!/usr/bin/env node

const msgpack = require('msgpack-lite');
const path = require('path');
const WebSocket = require('ws');
const util = require('util');

const ws = new WebSocket('ws://127.0.0.1:1732')
	.on('message', (msg, flags) => {
		msg = flags.binary ? msgpack.decode(msg) : JSON.parse(msg);
		console.log(util.inspect(msg, false, null, true));
		if (msg.type === 'exit') {
			process.exit(0);
		}
	})
	.on('close', () => {
		console.log('CLOSED');
		process.exit(0);
	})
	.on('open', () => ws.send(JSON.stringify({
		version: '1.0',
		path: '/appcd/subprocess/spawn/node',
		id: '1',
		data: {
			args: [ path.resolve(__dirname, '..', 'resources', 'echo-node-ver.js') ]
		}
	})));
