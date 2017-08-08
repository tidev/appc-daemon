import path from 'path';

import { spawn } from 'child_process';

describe('Plugin Host', () => {
	it('should error when trying to run the plugin host without IPC', function (done) {
		this.timeout(10000);
		this.slow(9000);

		const child = spawn(process.execPath, [
			path.resolve(__dirname, '..', 'bin', 'appcd-plugin-host')
		]);

		let stdout = '';
		child.stdout.on('data', data => {
			stdout += data.toString();
		});

		let stderr = '';
		child.stderr.on('data', data => {
			stderr += data.toString();
		});

		child.on('close', code => {
			try {
				console.log(stdout);
				console.log(stderr);
				expect(code).to.equal(2);
				expect(stdout).to.equal('');
				expect(stderr).to.equal('The Appc Daemon plugin host cannot be directly executed.\n');
				done();
			} catch (e) {
				done(e);
			}
		});
	});

	it('should error if no plugin path is specified', function (done) {
		this.timeout(10000);
		this.slow(9000);

		const child = spawn(process.execPath, [
			path.resolve(__dirname, '..', 'bin', 'appcd-plugin-host')
		], { stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ] });

		let stdout = '';
		child.stdout.on('data', data => {
			stdout += data.toString();
		});

		let stderr = '';
		child.stderr.on('data', data => {
			stderr += data.toString();
		});

		child.on('close', code => {
			try {
				expect(code).to.equal(3);
				expect(stdout).to.equal('');
				expect(stderr).to.equal('Missing plugin path argument.\n');
				done();
			} catch (e) {
				done(e);
			}
		});
	});

	it('should error when trying to run an internal plugin', function (done) {
		this.timeout(10000);
		this.slow(9000);

		const child = spawn(process.execPath, [
			path.resolve(__dirname, '..', 'bin', 'appcd-plugin-host'),
			path.join(__dirname, 'fixtures', 'good-internal')
		], { stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ] });

		let stdout = '';
		child.stdout.on('data', data => {
			stdout += data.toString();
		});

		let stderr = '';
		child.stderr.on('data', data => {
			stderr += data.toString();
		});

		child.on('close', code => {
			try {
				expect(code).to.equal(4);
				expect(stdout).to.equal('');
				expect(stderr).to.equal('Invalid plugin type "internal". Only "external" plugins can be run from the plugin host process.\n');
				done();
			} catch (e) {
				done(e);
			}
		});
	});

	it('should error if running with wrong Node.js version', function (done) {
		this.timeout(10000);
		this.slow(9000);

		const child = spawn(process.execPath, [
			path.resolve(__dirname, '..', 'bin', 'appcd-plugin-host'),
			path.join(__dirname, 'fixtures', 'wrong-node-ver-external')
		], { stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ] });

		let stdout = '';
		child.stdout.on('data', data => {
			stdout += data.toString();
		});

		let stderr = '';
		child.stderr.on('data', data => {
			stderr += data.toString();
		});

		child.on('close', code => {
			try {
				expect(code).to.equal(5);
				expect(stdout).to.equal('');
				expect(stderr).to.equal(`This plugin requires Node.js 1.2.3, but currently running ${process.version}\n`);
				done();
			} catch (e) {
				done(e);
			}
		});
	});
});
