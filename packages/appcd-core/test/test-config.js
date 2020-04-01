import path from 'path';
import tmp from 'tmp';

import { loadConfig } from '../dist/config';

const tmpHomeDir = tmp.dirSync({
	mode: '755',
	prefix: 'appcd-core-test-home-',
	unsafeCleanup: true
}).name;

describe('Config', () => {
	before(function () {
		this.HOME        = process.env.HOME;
		this.HOMEDRIVE   = process.env.HOMEDRIVE;
		this.HOMEPATH    = process.env.HOMEPATH;
		this.USERPROFILE = process.env.USERPROFILE;

		process.env.HOME = process.env.USERPROFILE = tmpHomeDir;
		if (process.platform === 'win32') {
			process.env.HOMEDRIVE = path.parse(tmpHomeDir).root.replace(/[\\/]/g, '');
			process.env.HOMEPATH = tmpHomeDir.replace(process.env.HOMEDRIVE, '');
		}
	});

	after(function () {
		process.env.HOME        = this.HOME;
		process.env.HOMEDRIVE   = this.HOMEDRIVE;
		process.env.HOMEPATH    = this.HOMEPATH;
		process.env.USERPROFILE = this.USERPROFILE;
	});

	it('should mix runtime config on top of base config', () => {
		const cfg = loadConfig({
			config: {
				environment: {
					name: 'test',
					title: 'Test'
				},
				plugins: {
					installDefault: false
				},
				server: {
					persistDebugLog: true
				},
				telemetry: {
					environment: 'test'
				}
			}
		});

		expect(cfg.get()).to.deep.equal({
			core: {
				enforceNodeVersion: true,
				v8: {
					memory: 'auto'
				}
			},
			environment: {
				name: 'test',
				title: 'Test'
			},
			home: '~/.appcelerator/appcd',
			network: {
				agentOptions: null,
				caFile: null,
				certFile: null,
				httpProxy: null,
				httpsProxy: null,
				keyFile: null,
				passphrase: null,
				strictSSL: true
			},
			plugins: {
				autoReload: true,
				defaultInactivityTimeout: 60 * 60 * 1000,
				installDefault: false
			},
			server: {
				agentPollInterval: 1000,
				daemonize: true,
				group: null,
				hostname: '127.0.0.1',
				nodejsMaxUnusedAge: 90 * 24 * 60 * 60 * 1000,
				persistDebugLog: true,
				pidFile: '~/.appcelerator/appcd/appcd.pid',
				port: 1732,
				user: null
			},
			telemetry: {
				app: 'ea327577-858f-4d31-905e-fa670f50ef48',
				enabled: true,
				environment: 'test',
				eventsDir: '~/.appcelerator/appcd/telemetry',
				sendBatchSize: 10,
				sendInterval: 60000,
				sendTimeout: 60000,
				url: 'https://api.appcelerator.com/p/v4/app-track'
			}
		});
	});
});
