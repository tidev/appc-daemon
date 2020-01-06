import fs from 'fs-extra';
import globule from 'globule';
import path from 'path';
import snooplogg from 'snooplogg';
import tmp from 'tmp';

import { installDefaultPlugins } from '../dist/index';

const { log } = snooplogg('test:appcd:default-plugins');
const { highlight } = snooplogg.styles;

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
		log(`Installing default plugins to: ${highlight(dir)}`);

		await installDefaultPlugins(dir);
		log(globule.find([ '*', 'packages/*/*' ], { srcBase: dir }));

		expect(fs.existsSync(path.join(dir, 'node_modules'))).to.be.true;
		expect(fs.existsSync(path.join(dir, 'lerna.json'))).to.be.true;
		expect(fs.existsSync(path.join(dir, 'package.json'))).to.be.true;
	});
});
