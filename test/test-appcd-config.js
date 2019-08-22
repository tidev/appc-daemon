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
	this.timeout(30000);

	describe('help', () => {
		it('should output help as JSON', makeTest(async function () {
			const { status, stdout } = this.runAppcdSync([ 'config', '--help', '--json' ]);
			expect(status).to.equal(2);
			expect(JSON.parse(stdout).desc).to.equal('Get and set config options');
		}));
	});

	const states = [
		'stopped',
		'started'
	];

	const actions = [
		'get',
		'ls',
		'list'
	];

	for (const appcdState of states) {
		describe(`appcd ${appcdState}`, () => {
			for (const action of actions) {
				describe(action, () => {
					it(`should ${action} default config as text with banner`, makeTest(async function () {
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
		});
	}

	describe.skip('set', () => {
		// it('should set a value with no existing config file', async function () {
		// 	return runSync({
		// 		args: [ 'config', '--json', 'set', 'foo', 'bar' ],
		// 		then({ status, stdout }) {
		// 			expect(status).to.equal(0);
		// 			expect(JSON.parse(stdout)).to.deep.equal({
		// 				code: 0,
		// 				result: 'Saved'
		// 			});
		// 			expect(fs.readJSONSync(configFile)).to.deep.equal({ foo: 'bar' });
		// 		}
		// 	});
		// });
	});
});

/*
const { cleanConfig, preCheck, readConfig, restoreConfigFile, runJSONCommand, writeConfig } = require('./utils');
let backupFile;

describe('amplify config integration tests', function () {
	this.timeout(5000);

	before(function () {
		backupFile = preCheck();
	});

	beforeEach(function () {
		cleanConfig();
	});

	after(function () {
		if (backupFile) {
			restoreConfigFile(backupFile);
		}
	});

	[ 'get', 'ls', 'list'].forEach( function (getCommand) {
		it(`config can list a specific value with ${getCommand}`, async function () {
			writeConfig({
				foo: 'bar'
			});

			const getCmd =  await runJSONCommand([ 'config', getCommand, 'foo' ]);
			expect(getCmd.code).to.equal(0);
			expect(getCmd.stdout.result).to.equal('bar');
		});

		it(`config can list entire config with ${getCommand}`, async function () {
			writeConfig({
				foo: 'bar',
				bar: 'foo'
			});

			const getCmd =  await runJSONCommand([ 'config', getCommand ]);
			expect(getCmd.code).to.equal(0);
			expect(getCmd.stdout.code).to.equal(0);
			expect(getCmd.stdout.result).to.deep.equal({ bar: 'foo', foo: 'bar' });
		});
	})

	it('config can list entire config', async function () {
		writeConfig({
			foo: 'bar',
			bar: 'foo'
		});

		const getCmd =  await runJSONCommand([ 'config', 'get' ]);
		expect(getCmd.code).to.equal(0);
		expect(getCmd.stdout.code).to.equal(0);
		expect(getCmd.stdout.result).to.deep.equal({ bar: 'foo', foo: 'bar' });
	});

	[ 'delete', 'rm', 'remove', 'unset' ].forEach(function(removalCommand) {

		it(`config can delete values with ${removalCommand}`, async function () {
			writeConfig({
				foo: 'bar'
			});

			const deleteCmd = await runJSONCommand([ 'config', removalCommand, 'foo' ]);
			expect(deleteCmd.code).to.equal(0);
			expect(deleteCmd.stdout.code).to.equal(0);
			expect(deleteCmd.stdout.result).to.equal('Saved');

			const getCmd =  await runJSONCommand([ 'config', 'get', 'foo' ]);
			expect(getCmd.code).to.equal(6);
			expect(getCmd.code).to.equal(6);
			expect(getCmd.stdout.result).to.equal('Not Found: foo');
		});

	});

	it('config can push to arrays', async function () {
		writeConfig({
			foo: [ 'avalue' ]
		});

		const pushCmd = await runJSONCommand([ 'config', 'push', 'foo', 'bar' ]);
		expect(pushCmd.code).to.equal(0);
		expect(pushCmd.code).to.equal(0);
		expect(pushCmd.stdout.result).to.deep.equal([ 'avalue', 'bar' ]);

		const config = readConfig();
		expect(config).to.deep.equal({ foo: [ 'avalue', 'bar' ] });

		const invalidShiftCmd = await runJSONCommand([ 'config', 'push', 'bar', 'foo' ]);
		expect(invalidShiftCmd.code).to.equal(0);
		expect(invalidShiftCmd.stdout.code).to.equal(0);
		expect(invalidShiftCmd.stdout.result).to.deep.equal([ 'foo' ]);
	});

	it('config can pop values from arrays', async function () {
		writeConfig({
			foo: [ 'avalue', 'poppedval' ]
		});

		const popCmd = await runJSONCommand([ 'config', 'pop', 'foo' ]);
		expect(popCmd.code).to.equal(0);
		expect(popCmd.code).to.equal(0);
		expect(popCmd.stdout.result).to.equal('poppedval');

		const config = readConfig();
		expect(config).to.deep.equal({ foo: [ 'avalue' ] });

		const invalidPopCmd = await runJSONCommand([ 'config', 'pop', 'bar' ]);
		expect(invalidPopCmd.code).to.equal(6);
		expect(invalidPopCmd.stdout.code).to.equal(6);
		expect(invalidPopCmd.stdout.result).to.equal('Not Found: bar');
	});

	it('config can shift values from arrays', async function () {
		writeConfig({
			foo: [ 'shiftedval', 'bar' ]
		});

		const shiftCmd = await runJSONCommand([ 'config', 'shift', 'foo' ]);
		expect(shiftCmd.code).to.equal(0);
		expect(shiftCmd.code).to.equal(0);
		expect(shiftCmd.stdout.result).to.equal('shiftedval');

		const config = readConfig();
		expect(config).to.deep.equal({ foo: [ 'bar' ] });

		const invalidShiftCmd = await runJSONCommand([ 'config', 'shift', 'bar' ]);
		expect(invalidShiftCmd.code).to.equal(6);
		expect(invalidShiftCmd.stdout.code).to.equal(6);
		expect(invalidShiftCmd.stdout.result).to.equal('Not Found: bar');
	});

	it('config can unshift values to an array', async function () {
		writeConfig({
			foo: [ 'bar' ]
		});

		const pushCmd = await runJSONCommand([ 'config', 'unshift', 'foo', 'unshiftedval' ]);
		expect(pushCmd.code).to.equal(0);
		expect(pushCmd.code).to.equal(0);
		expect(pushCmd.stdout.result).to.deep.equal([ 'unshiftedval', 'bar']);

		const config = readConfig();
		expect(config).to.deep.equal({ foo: [ 'unshiftedval', 'bar' ] });

		const invalidShiftCmd = await runJSONCommand([ 'config', 'unshift', 'bar', 'foo' ]);
		expect(invalidShiftCmd.code).to.equal(0);
		expect(invalidShiftCmd.stdout.code).to.equal(0);
		expect(invalidShiftCmd.stdout.result).to.deep.equal([ 'foo' ]);
	});
});
*/
