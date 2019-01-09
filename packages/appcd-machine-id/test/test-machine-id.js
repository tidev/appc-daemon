import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';

import getMachineId from '../dist/machine-id';

tmp.setGracefulCleanup();
function makeTempDir() {
	return tmp.dirSync({
		mode: '755',
		prefix: 'appcd-machine-id-test-',
		unsafeCleanup: true
	}).name;
}

describe('machine-id', () => {
	beforeEach(() => {
		delete process.env.APPCD_TEST_PLATFORM;
	});

	afterEach(() => {
		delete process.env.APPCD_TEST_PLATFORM;
	});

	it('should get or generate a mid', async () => {
		const mid = await getMachineId();
		expect(mid).to.be.a('string');
		expect(mid).to.have.lengthOf(40);
	});

	it('should load mid from a file', async () => {
		// NOTE: the mid in good.mid is valid, but because it won't match the
		// detected machine's id, it will be overwritten by the real one
		const file = path.join(makeTempDir(), 'good.mid');
		await fs.copy(path.join(__dirname, 'fixtures', 'good.mid'), file);
		const mid = await getMachineId(file);

		expect(mid).to.be.a('string');
		expect(mid).to.have.lengthOf(40);
		expect(mid).to.equal(fs.readFileSync(file, 'utf8').split('\n')[0]);
	});

	it('should be ok if mid file is empty', async () => {
		const file = path.join(makeTempDir(), 'empty.mid');
		await fs.copy(path.join(__dirname, 'fixtures', 'empty.mid'), file);
		const mid = await getMachineId(file);

		expect(mid).to.be.a('string');
		expect(mid).to.have.lengthOf(40);
		expect(mid).to.equal(fs.readFileSync(file, 'utf8').split('\n')[0]);
	});

	it('should be ok if mid file is bad', async () => {
		const file = path.join(makeTempDir(), 'bad.mid');
		await fs.copy(path.join(__dirname, 'fixtures', 'bad.mid'), file);
		const mid = await getMachineId(file);

		expect(mid).to.be.a('string');
		expect(mid).to.have.lengthOf(40);
		expect(mid).to.equal(fs.readFileSync(file, 'utf8').split('\n')[0]);
	});

	it('should be ok if mid file does not exist', async () => {
		const file = path.join(makeTempDir(), 'test.mid');
		const mid = await getMachineId(file);

		expect(mid).to.be.a('string');
		expect(mid).to.have.lengthOf(40);
		expect(mid).to.equal(fs.readFileSync(file, 'utf8').split('\n')[0]);
	});

	it('should throw error if mid file is invalid', async () => {
		try {
			await getMachineId(123);
		} catch (err) {
			expect(err).to.be.instanceof(TypeError);
			expect(err.message).to.equal('Expected midFile to be a string');
			return;
		}
		throw new Error('Expected error');
	});

	it('should fallback to the macaddress if cannot get native machine guid', async () => {
		process.env.APPCD_TEST_PLATFORM = 'linux';
		const mid = await getMachineId();
		expect(mid).to.be.a('string');
		expect(mid).to.have.lengthOf(40);
	});
});
