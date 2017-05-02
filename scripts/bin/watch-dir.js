#!/usr/bin/env node

const msgpack = require('msgpack-lite');
const WebSocket = require('ws');
const util = require('util');

if (process.argv.length < 3) {
	console.error('Usage: node watch-dir.js /path/to/watch');
	process.exit(1);
}

const ws = new WebSocket('ws://127.0.0.1:1732', {
		headers: {
			'User-Agent': __filename
		}
	})
	.on('message', (msg, flags) => {
		msg = flags.binary ? msgpack.decode(msg) : JSON.parse(msg);
		console.log(util.inspect(msg, false, null, true));
		if (msg.type === 'exit') {
			process.exit(0);
		}
	})
	.on('close', () => console.log('CLOSED'))
	.on('open', () => ws.send(JSON.stringify({
		version: '1.0',
		path: '/appcd/fswatch',
		id: '1',
		data: {
			path: process.argv[2] || process.cwd()
		},
		type: 'subscribe'
	})));
