import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
	defaultConfig,
	makeTest,
	stripColors
} from './common';

const configFile = path.join(os.homedir(), '.appcelerator', 'appcd', 'config.json');

describe('appcd config', function () {
	this.timeout(120000);

	describe('help', () => {
		it('should output help as JSON', makeTest(async function () {
			const { status, stdout } = this.runAppcdSync([ 'config', '--help', '--json' ]);
			expect(status).to.equal(2);
			expect(JSON.parse(stdout).desc).to.equal('Get and set config options');
		}));
	});

	describe('Error handling', () => {
		it('should error when loading a bad config file when daemon not running', makeTest(async function () {
			await this.initHomeDir(path.join(__dirname, 'fixtures', 'config', 'bad'));

			const { status, stdout, stderr } = this.runAppcdSync([ 'config', 'get' ], {}, defaultConfig);

			expect(status).to.equal(1);
			expect(stripColors(stdout.toString())).to.match(/^Appcelerator Daemon, version \d+\.\d+\.\d+\nCopyright \(c\) 2015-\d{4}, Axway, Inc\. All Rights Reserved\./);
			expect(stderr.toString().split('\n\n')[0]).to.equal('Error: Failed to load config file: SyntaxError: Unexpected token { in JSON at position 1');
		}));

		it('should error when loading a bad config file when starting daemon', makeTest(async function () {
			await this.initHomeDir(path.join(__dirname, 'fixtures', 'config', 'bad'));

			const { status, stdout, stderr } = this.runAppcdSync([ 'start' ], {}, defaultConfig);

			expect(status).to.equal(1);
			expect(stripColors(stdout.toString())).to.match(/^Appcelerator Daemon, version \d+\.\d+\.\d+\nCopyright \(c\) 2015-\d{4}, Axway, Inc\. All Rights Reserved\./);
			expect(stderr.toString().split('\n\n')[0]).to.equal('Error: Failed to load config file: SyntaxError: Unexpected token { in JSON at position 1');
		}));

		it('should not error when config file is empty', makeTest(async function () {
			await this.initHomeDir(path.join(__dirname, 'fixtures', 'config', 'empty'));

			const { status, stdout } = this.runAppcdSync([ 'config', 'get' ], {}, defaultConfig);

			expect(status).to.equal(0);

			// strip off the banner
			const chunks = stdout.toString().split('\n\n');
			expect(stripColors(chunks[0])).to.match(/^Appcelerator Daemon, version \d+\.\d+\.\d+\nCopyright \(c\) 2015-\d{4}, Axway, Inc\. All Rights Reserved\./);
			expect(chunks[1]).to.equal([
				'core.enforceNodeVersion          = true',
				'core.v8.memory                   = auto',
				'environment.name                 = test',
				'environment.title                = Test',
				'home                             = ~/.appcelerator/appcd',
				'network.agentOptions             = null',
				'network.caFile                   = null',
				'network.certFile                 = null',
				'network.httpProxy                = null',
				'network.httpsProxy               = null',
				'network.keyFile                  = null',
				'network.passphrase               = null',
				'network.strictSSL                = true',
				'plugins.autoReload               = true',
				'plugins.defaultInactivityTimeout = 3600000',
				'plugins.installDefault           = false',
				'server.agentPollInterval         = 1000',
				'server.daemonize                 = true',
				'server.group                     = null',
				'server.hostname                  = 127.0.0.1',
				'server.nodejsMaxUnusedAge        = 7776000000',
				'server.pidFile                   = ~/.appcelerator/appcd/appcd.pid',
				'server.port                      = 1732',
				'server.user                      = null',
				'telemetry.app                    = ea327577-858f-4d31-905e-fa670f50ef48',
				'telemetry.enabled                = true',
				'telemetry.environment            = test',
				'telemetry.eventsDir              = ~/.appcelerator/appcd/telemetry',
				'telemetry.sendBatchSize          = 10',
				'telemetry.sendInterval           = 60000',
				'telemetry.sendTimeout            = 60000',
				'telemetry.url                    = https://api.appcelerator.com/p/v4/app-track'
			].join('\n') + '\n');
		}));
	});

	const states = [
		// 'stopped',
		'started'
	];

	let getActions = [
		'get' // ,
		// 'ls',
		// 'list'
	];

	let removeActions = [
		'delete',
		'rm',
		'remove',
		'unset'
	];

	for (const appcdState of states) {
		describe(`appcd ${appcdState}`, () => {
			for (const action of getActions) {
				describe(action, () => {
					it.only(`should ${action} default config as text with banner`, makeTest(async function () {
						if (appcdState === 'started') {
							await this.installNode();
							await this.startDaemonDebugMode(defaultConfig);
						}

						const { status, stdout } = this.runAppcdSync([ 'config', action ], {}, defaultConfig);

						expect(status).to.equal(0);

						// strip off the banner
						const chunks = stdout.toString().split('\n\n');
						expect(stripColors(chunks[0])).to.match(/^Appcelerator Daemon, version \d+\.\d+\.\d+\nCopyright \(c\) 2015-\d{4}, Axway, Inc\. All Rights Reserved\./);
						expect(chunks[1]).to.equal([
							'core.enforceNodeVersion          = true',
							'core.v8.memory                   = auto',
							'environment.name                 = test',
							'environment.title                = Test',
							'home                             = ~/.appcelerator/appcd',
							'network.agentOptions             = null',
							'network.caFile                   = null',
							'network.certFile                 = null',
							'network.httpProxy                = null',
							'network.httpsProxy               = null',
							'network.keyFile                  = null',
							'network.passphrase               = null',
							'network.strictSSL                = true',
							'plugins.autoReload               = true',
							'plugins.defaultInactivityTimeout = 3600000',
							'plugins.installDefault           = false',
							'server.agentPollInterval         = 1000',
							'server.daemonize                 = true',
							'server.group                     = null',
							'server.hostname                  = 127.0.0.1',
							'server.nodejsMaxUnusedAge        = 7776000000',
							'server.pidFile                   = ~/.appcelerator/appcd/appcd.pid',
							'server.port                      = 1732',
							'server.user                      = null',
							'telemetry.app                    = ea327577-858f-4d31-905e-fa670f50ef48',
							'telemetry.enabled                = true',
							'telemetry.environment            = test',
							'telemetry.eventsDir              = ~/.appcelerator/appcd/telemetry',
							'telemetry.sendBatchSize          = 10',
							'telemetry.sendInterval           = 60000',
							'telemetry.sendTimeout            = 60000',
							'telemetry.url                    = https://api.appcelerator.com/p/v4/app-track'
						].join('\n') + '\n');
					}));

					it(`should ${action} default config as text without banner`, makeTest(async function () {
						if (appcdState === 'started') {
							await this.installNode();
							await this.startDaemonDebugMode(defaultConfig);
						}

						const { status, stdout } = this.runAppcdSync([ 'config', action, '--no-banner' ], {}, defaultConfig);
						expect(status).to.equal(0);

						// strip off the banner
						expect(stdout.toString()).to.equal([
							'core.enforceNodeVersion          = true',
							'core.v8.memory                   = auto',
							'environment.name                 = test',
							'environment.title                = Test',
							'home                             = ~/.appcelerator/appcd',
							'network.agentOptions             = null',
							'network.caFile                   = null',
							'network.certFile                 = null',
							'network.httpProxy                = null',
							'network.httpsProxy               = null',
							'network.keyFile                  = null',
							'network.passphrase               = null',
							'network.strictSSL                = true',
							'plugins.autoReload               = true',
							'plugins.defaultInactivityTimeout = 3600000',
							'plugins.installDefault           = false',
							'server.agentPollInterval         = 1000',
							'server.daemonize                 = true',
							'server.group                     = null',
							'server.hostname                  = 127.0.0.1',
							'server.nodejsMaxUnusedAge        = 7776000000',
							'server.pidFile                   = ~/.appcelerator/appcd/appcd.pid',
							'server.port                      = 1732',
							'server.user                      = null',
							'telemetry.app                    = ea327577-858f-4d31-905e-fa670f50ef48',
							'telemetry.enabled                = true',
							'telemetry.environment            = test',
							'telemetry.eventsDir              = ~/.appcelerator/appcd/telemetry',
							'telemetry.sendBatchSize          = 10',
							'telemetry.sendInterval           = 60000',
							'telemetry.sendTimeout            = 60000',
							'telemetry.url                    = https://api.appcelerator.com/p/v4/app-track'
						].join('\n') + '\n');
					}));

					it(`should ${action} default config as JSON`, makeTest(async function () {
						if (appcdState === 'started') {
							await this.installNode();
							await this.startDaemonDebugMode(defaultConfig);
						}

						const { status, stdout } = this.runAppcdSync([ 'config', action, '--json' ], {}, defaultConfig);
						expect(status).to.equal(0);

						expect(JSON.parse(stdout)).to.deep.equal({
							code: 0,
							result: {
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
							}
						});
					}));

					it(`should ${action} an existing value as JSON`, makeTest(async function () {
						if (appcdState === 'started') {
							await this.installNode();
							await this.startDaemonDebugMode(defaultConfig);
						}

						const { status, stdout } = this.runAppcdSync([ 'config', action, 'server.port', '--json' ]);
						expect(status).to.equal(0);
						expect(JSON.parse(stdout)).to.deep.equal({
							code: 0,
							result: 1732
						});
					}));

					it(`should ${action} an existing group of values as JSON`, makeTest(async function () {
						if (appcdState === 'started') {
							await this.installNode();
							await this.startDaemonDebugMode(defaultConfig);
						}

						const { status, stdout } = this.runAppcdSync([ 'config', action, 'server', '--json' ]);
						expect(status).to.equal(0);
						expect(JSON.parse(stdout)).to.deep.equal({
							code: 0,
							result: {
								agentPollInterval: 1000,
								daemonize: true,
								group: null,
								hostname: '127.0.0.1',
								nodejsMaxUnusedAge: 90 * 24 * 60 * 60 * 1000,
								pidFile: '~/.appcelerator/appcd/appcd.pid',
								port: 1732,
								user: null
							}
						});
					}));

					it(`should not ${action} a non-existent value as text`, makeTest(async function () {
						if (appcdState === 'started') {
							await this.installNode();
							await this.startDaemonDebugMode(defaultConfig);
						}

						const { status, stdout, stderr } = this.runAppcdSync([ 'config', action, 'does.not.exist' ]);
						expect(status).to.equal(1);

						expect(stripColors(stdout.toString())).to.match(/^Appcelerator Daemon, version \d+\.\d+\.\d+\nCopyright \(c\) 2015-\d{4}, Axway, Inc\. All Rights Reserved\./);
						expect(stderr.toString().split('\n\n')[0]).to.equal('Error: Not Found: does.not.exist');
					}));

					it(`should not ${action} a non-existent value as JSON`, makeTest(async function () {
						if (appcdState === 'started') {
							await this.installNode();
							await this.startDaemonDebugMode(defaultConfig);
						}

						const { status, stdout } = this.runAppcdSync([ 'config', action, 'does.not.exist', '--json' ]);
						expect(status).to.equal(1);

						const res = JSON.parse(stdout);
						expect(res.error).to.be.an('object');
						expect(res.error.type).to.equal('Error');
						expect(res.error.message).to.equal('Not Found: does.not.exist');
					}));

					if (appcdState === 'started') {
						it(`should ${action} a setting passed in from the command line`, makeTest(async function () {
							await this.installNode();
							await this.startDaemonDebugMode({ ...defaultConfig, 'appcd-test': 'it works!' });

							const { status, stdout } = this.runAppcdSync([ 'config', action, 'appcd-test', '--json' ], {}, { 'appcd-test': 'it works!' });
							expect(status).to.equal(0);
							expect(JSON.parse(stdout)).to.deep.equal({
								code: 0,
								result: 'it works!'
							});
						}));

						it(`should not ${action} a setting passed in from the command line if the server is running`, makeTest(async function () {
							await this.installNode();
							await this.startDaemonDebugMode(defaultConfig);

							const { status, stdout } = this.runAppcdSync([ 'config', action, 'appcd-test', '--json' ], {}, { 'appcd-test': 'it works!' });
							expect(status).to.equal(1);
							const { error } = JSON.parse(stdout);
							expect(error).to.be.an('object');
							expect(error.message).to.equal('Not Found: appcd-test');
							expect(error.type).to.equal('Error');
						}));
					} else {
						it(`should ${action} a setting passed in from the command line`, makeTest(async function () {
							const { status, stdout } = this.runAppcdSync([ 'config', action, 'appcd-test', '--json' ], {}, { 'appcd-test': 'it works!' });
							expect(status).to.equal(0);
							expect(JSON.parse(stdout)).to.deep.equal({
								code: 0,
								result: 'it works!'
							});
						}));
					}
				});
			}

			describe('set', () => {
				it('should error when calling set without a name or value', makeTest(async function () {
					if (appcdState === 'started') {
						await this.installNode();
						await this.startDaemonDebugMode(defaultConfig);
					}

					const { status, stderr } = this.runAppcdSync([ 'config', 'set' ]);
					expect(status).to.equal(1);
					expect(stderr.toString().split('\n\n')[0]).to.equal('Error: Missing the configuration key to set');
				}));

				it('should error when calling set without a value', makeTest(async function () {
					if (appcdState === 'started') {
						await this.installNode();
						await this.startDaemonDebugMode(defaultConfig);
					}

					const { status, stderr } = this.runAppcdSync([ 'config', 'set', 'appcd-test' ]);
					expect(status).to.equal(1);
					expect(stderr.toString().split('\n\n')[0]).to.equal('Error: Missing the configuration value to set');
				}));

				it('should set a value with no existing config file', makeTest(async function () {
					if (appcdState === 'started') {
						await this.installNode();
						await this.startDaemonDebugMode(defaultConfig);
					}

					expect(fs.existsSync(configFile)).to.be.false;
					const { status, stdout } = this.runAppcdSync([ 'config', 'set', 'appcd-test', 'it works!' ]);

					expect(status).to.equal(0);
					expect(stdout.toString().split('\n\n')[1].trim()).to.equal('Saved');

					expect(fs.existsSync(configFile)).to.be.true;
					expect(fs.readJsonSync(configFile)).to.deep.equal({
						'appcd-test': 'it works!'
					});
				}));

				it('should set a value with no existing config file as JSON', makeTest(async function () {
					if (appcdState === 'started') {
						await this.installNode();
						await this.startDaemonDebugMode(defaultConfig);
					}

					expect(fs.existsSync(configFile)).to.be.false;
					const { status, stdout } = this.runAppcdSync([ 'config', '--json', 'set', 'appcd-test', 'it works!' ]);

					expect(status).to.equal(0);
					expect(JSON.parse(stdout)).to.deep.equal({
						code: 0,
						result: 'Saved'
					});

					expect(fs.existsSync(configFile)).to.be.true;
					expect(fs.readJsonSync(configFile)).to.deep.equal({
						'appcd-test': 'it works!'
					});
				}));
			});

			for (const action of removeActions) {
				describe(action, () => {
					it(`should ${action} config value`, makeTest(async function () {
						await this.initHomeDir(path.join(__dirname, 'fixtures', 'config', 'foo'));

						if (appcdState === 'started') {
							await this.installNode();
							await this.startDaemonDebugMode(defaultConfig);
						}

						const { status, stdout } = this.runAppcdSync([ 'config', '--json', action, 'foo' ], {}, defaultConfig);

						expect(status).to.equal(0);

						expect(JSON.parse(stdout)).to.deep.equal({
							code: 0,
							result: 'Saved'
						});

						expect(fs.existsSync(configFile)).to.be.true;
						expect(fs.readJsonSync(configFile)).to.deep.equal({});
					}));
				});
			}

			describe('arrays', () => {
				it('should push to an array config value', makeTest(async function () {
					await this.initHomeDir(path.join(__dirname, 'fixtures', 'config', 'array'));

					if (appcdState === 'started') {
						await this.installNode();
						await this.startDaemonDebugMode(defaultConfig);
					}

					const { status, stdout } = this.runAppcdSync([ 'config', '--json', 'push', 'foo', 'bar' ]);
					expect(status).to.equal(0);
					expect(JSON.parse(stdout).result).to.deep.equal([ 'a', 'b', 'c', 'bar' ]);
					expect(fs.readJsonSync(configFile)).to.deep.equal({
						foo: [ 'a', 'b', 'c', 'bar' ]
					});
				}));

				it('should pop from an array config value', makeTest(async function () {
					await this.initHomeDir(path.join(__dirname, 'fixtures', 'config', 'array'));

					if (appcdState === 'started') {
						await this.installNode();
						await this.startDaemonDebugMode(defaultConfig);
					}

					const { status, stdout } = this.runAppcdSync([ 'config', '--json', 'pop', 'foo' ]);
					expect(status).to.equal(0);
					expect(JSON.parse(stdout).result).to.equal('c');
					expect(fs.readJsonSync(configFile)).to.deep.equal({ foo: [ 'a', 'b' ] });
				}));

				it('should shift an array config value', makeTest(async function () {
					await this.initHomeDir(path.join(__dirname, 'fixtures', 'config', 'array'));

					if (appcdState === 'started') {
						await this.installNode();
						await this.startDaemonDebugMode(defaultConfig);
					}

					const { status, stdout } = this.runAppcdSync([ 'config', '--json', 'shift', 'foo' ]);
					expect(status).to.equal(0);
					expect(JSON.parse(stdout).result).to.equal('a');
					expect(fs.readJsonSync(configFile)).to.deep.equal({ foo: [ 'b', 'c' ] });
				}));

				it('should unshift an array config value', makeTest(async function () {
					await this.initHomeDir(path.join(__dirname, 'fixtures', 'config', 'array'));

					if (appcdState === 'started') {
						await this.installNode();
						await this.startDaemonDebugMode(defaultConfig);
					}

					const { status, stdout } = this.runAppcdSync([ 'config', '--json', 'unshift', 'foo', 'bar' ]);
					expect(status).to.equal(0);
					expect(JSON.parse(stdout).result).to.deep.equal([ 'bar', 'a', 'b', 'c' ]);
					expect(fs.readJsonSync(configFile)).to.deep.equal({ foo: [ 'bar', 'a', 'b', 'c' ] });
				}));
			});
		});
	}
});
