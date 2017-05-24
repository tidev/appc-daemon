#!/usr/bin/env node

const msgpack = require('msgpack-lite');
const util = require('util');
const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:1732', {
		headers: {
			'User-Agent': __filename
		}
	})
	.on('message', msg => {
		console.log(util.inspect(typeof msg === 'string' ? JSON.parse(msg) : msgpack.decode(msg), false, null, true));
	})
	.on('close', () => console.log('CLOSED'))
	.on('open', () => ws.send(JSON.stringify({ version: '1.0', path: '/appcd/status/system', id: '1', type: 'subscribe' })));
