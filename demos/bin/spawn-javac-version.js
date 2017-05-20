#!/usr/bin/env node

const msgpack = require('msgpack-lite');
const WebSocket = require('ws');
const util = require('util');

const ws = new WebSocket('ws://127.0.0.1:1732', {
		headers: {
			'User-Agent': __filename
		}
	})
	.on('message', msg => {
		msg = typeof msg === 'string' ? JSON.parse(msg) : msgpack.decode(msg);
		console.log(util.inspect(msg, false, null, true));
		if (msg.type === 'exit') {
			process.exit(0);
		}
	})
	.on('close', () => console.log('CLOSED'))
	.on('open', () => ws.send(JSON.stringify({ version: '1.0', path: '/appcd/subprocess/spawn', id: '1', data: { command: 'javac', args: ['-version'] } })));
