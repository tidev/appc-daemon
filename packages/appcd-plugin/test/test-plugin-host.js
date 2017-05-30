import path from 'path';
import snooplogg from 'snooplogg';

import { spawn } from 'child_process';

const log = snooplogg.config({ theme: 'detailed' })('test:appcd:plugin:host').log;
const { highlight } = snooplogg.styles;

// describe('Plugin Host', () => {
// 	it('should initialize and activate a plugin', done => {
// 		let id = 1;
// 		let finished = false;
// 		const child = spawn(
// 			process.execPath,
// 			[ path.resolve(__dirname, '..', 'bin', 'appcd-plugin-host') ],
// 			{ stdio: [ 'ignore', 'inherit', 'inherit', 'ipc' ] }
// 		);
//
// 		child.on('close', code => {
// 			if (!finished) {
// 				done(new Error(`Plugin host quit (code ${code})`));
// 			}
// 		});
//
// 		child.on('message', msg => {
// 			try {
// 				console.log('GOT RESPONSE');
// 				console.log(msg);
//
// 				if (msg.id === 1) {
// 					expect(msg.status).to.equal(200);
// 					child.send({
// 						id: ++id,
// 						type: 'activate'
// 					});
// 				} else {
// 					finished = true;
// 					child.kill();
// 					done();
// 				}
// 			} catch (e) {
// 				done(e);
// 			}
// 		});
//
// 		const request = {
// 			id,
// 			type: 'init',
// 			data: {
// 				pluginPath: path.join(__dirname, 'fixtures', 'good-plugin')
// 			}
// 		};
// 		log('Sending request:');
// 		log(request);
// 		child.send(request);
// 	});
// });
