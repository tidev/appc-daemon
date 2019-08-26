import fs from 'fs-extra';
import path from 'path';
import {
	coreNodeVersion,
	defaultConfig,
	makeTest
} from './common';

let _it = it;
const pluginPath = path.resolve(__dirname, '..', 'plugins', 'jdk');
let pluginVersion;
try {
	pluginVersion = fs.readJsonSync(path.join(pluginPath, 'package.json')).version;
} catch (e) {
	_it = it.skip;
}

describe('plugin jdk', function () {
	this.timeout(120000);

	_it('should register the jdk plugin', makeTest(async function () {
		this.symlinkPlugin('jdk', pluginVersion);
		await this.installNode();
		await this.startDaemonDebugMode(defaultConfig);

		const { status, stdout } = this.runAppcdSync([ 'exec', '/jdk' ]);
		const obj = JSON.parse(stdout);

		expect(status).to.equal(0);

		expect(obj.status).to.equal(200);
		expect(obj.message).to.contain(pluginVersion);
		expect(obj.fin).to.equal(true);
		expect(obj.statusCode).to.equal('200');
	}));

	_it('should get the jdk plugin info', makeTest(async function () {
		this.symlinkPlugin('jdk', pluginVersion);
		await this.installNode();
		await this.startDaemonDebugMode(defaultConfig);

		const { status, stdout } = this.runAppcdSync([ 'exec', `/jdk/${pluginVersion}` ]);
		const obj = JSON.parse(stdout);

		expect(status).to.equal(0);

		expect(obj).to.be.an('object');
		expect(obj.status).to.equal(200);
		expect(obj.message).to.be.an('object');
		expect(obj.message.path).to.equal(pluginPath);
		expect(obj.message.packageName).to.equal('@appcd/plugin-jdk');
		expect(obj.message.version).to.equal(pluginVersion);
		expect(obj.message.main).to.equal(path.join(pluginPath, 'dist', 'index.js'));
		expect(obj.message.name).to.equal('jdk');
		expect(obj.message.type).to.equal('external');
		expect(obj.message.nodeVersion).to.equal(coreNodeVersion);
		expect(obj.message.supported).to.equal(true);
		expect(obj.message.services).to.deep.equal([ '/info', '/info/:filter*' ]);
		expect(obj.message.error).to.be.null;
		expect(obj.message.stack).to.be.null;
		expect(obj.message.pid).to.be.at.gt(0);
		expect(obj.message.exitCode).to.be.null;
		expect(obj.message.stats).to.be.an('object');
		expect(obj.message.startupTime).to.be.gt(1);
		expect(obj.message.state).to.equal('started');
		expect(obj.message.totalRequests).to.equal(1);
		expect(obj.message.activeRequests).to.equal(0);
		expect(obj.fin).to.equal(true);
		expect(obj.statusCode).to.equal('200');
	}));
});
