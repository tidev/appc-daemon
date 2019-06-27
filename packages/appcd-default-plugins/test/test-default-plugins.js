import fs from 'fs-extra';
import installDefaultPlugins from '../dist/index';
import path from 'path';
import tmp from 'tmp';

const tmpDir = tmp.dirSync({
	mode: '755',
	prefix: 'appcd-plugin-test-',
	unsafeCleanup: true
}).name;

function makeTempName() {
	return path.join(tmpDir, Math.random().toString(36).substring(7));
}

describe('Default Plugins', () => {
	after(() => {
		fs.removeSync(tmpDir);
	});

	it('should error if plugins directory is invalid', async () => {
		try {
			await installDefaultPlugins();
		} catch (e) {
			expect(e).to.be.instanceof(TypeError);
			expect(e.message).to.equal('Expected plugins directory to be a non-empty string');
			return;
		}

		throw new Error('Expected error');
	});

	it('should download and install the plugins', async function () {
		this.timeout(200000);
		this.slow(190000);

		const dir = makeTempName();
		await installDefaultPlugins(dir);

		expect(fs.existsSync(path.join(dir, 'node_modules'))).to.be.true;
		expect(fs.existsSync(path.join(dir, 'lerna.json'))).to.be.true;
		expect(fs.existsSync(path.join(dir, 'package.json'))).to.be.true;
		expect(fs.existsSync(path.join(dir, 'packages', '@appcd', 'plugin-android'))).to.be.true;
		expect(fs.existsSync(path.join(dir, 'packages', '@appcd', 'plugin-genymotion'))).to.be.true;
		expect(fs.existsSync(path.join(dir, 'packages', '@appcd', 'plugin-ios'))).to.be.true;
		expect(fs.existsSync(path.join(dir, 'packages', '@appcd', 'plugin-android'))).to.be.true;
		expect(fs.existsSync(path.join(dir, 'packages', '@appcd', 'plugin-android'))).to.be.true;
		expect(fs.existsSync(path.join(dir, 'packages', '@appcd', 'plugin-android'))).to.be.true;
		expect(fs.existsSync(path.join(dir, 'packages', '@appcd', 'plugin-android'))).to.be.true;
	});
});
