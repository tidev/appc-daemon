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

	it('should get or generate a mid', done => {
		getMachineId()
			.then(mid => {
				expect(mid).to.be.a('string');
				expect(mid).to.have.lengthOf(40);
				done();
			})
			.catch(done);
	});

	it('should load mid from a file', done => {
		// NOTE: the mid in good.mid is valid, but because it won't match the
		// detected machine's id, it will be overwritten by the real one
		const file = path.join(makeTempDir(), 'good.mid');
		fs.copySync(path.join(__dirname, 'fixtures', 'good.mid'), file);

		getMachineId(file)
			.then(mid => {
				expect(mid).to.be.a('string');
				expect(mid).to.have.lengthOf(40);
				expect(mid).to.equal(fs.readFileSync(file, 'utf8').split('\n')[0]);
				done();
			})
			.catch(done);
	});

	it('should be ok if mid file is empty', done => {
		const file = path.join(makeTempDir(), 'empty.mid');
		fs.copySync(path.join(__dirname, 'fixtures', 'empty.mid'), file);

		getMachineId(file)
			.then(mid => {
				expect(mid).to.be.a('string');
				expect(mid).to.have.lengthOf(40);
				expect(mid).to.equal(fs.readFileSync(file, 'utf8').split('\n')[0]);
				done();
			})
			.catch(done);
	});

	it('should be ok if mid file is bad', done => {
		const file = path.join(makeTempDir(), 'bad.mid');
		fs.copySync(path.join(__dirname, 'fixtures', 'bad.mid'), file);

		getMachineId(file)
			.then(mid => {
				expect(mid).to.be.a('string');
				expect(mid).to.have.lengthOf(40);
				expect(mid).to.equal(fs.readFileSync(file, 'utf8').split('\n')[0]);
				done();
			})
			.catch(done);
	});

	it('should be ok if mid file does not exist', done => {
		const file = path.join(makeTempDir(), 'test.mid');

		getMachineId(file)
			.then(mid => {
				expect(mid).to.be.a('string');
				expect(mid).to.have.lengthOf(40);
				expect(mid).to.equal(fs.readFileSync(file, 'utf8').split('\n')[0]);
				done();
			})
			.catch(done);
	});

	it('should throw error if mid file is invalid', () => {
		expect(() => {
			getMachineId(123);
		}).to.throw(TypeError, 'Expected midFile to be a string');
	});

	it('should fallback to the macaddress if cannot get native machine guid', done => {
		process.env.APPCD_TEST_PLATFORM = 'linux';
		getMachineId()
			.then(mid => {
				expect(mid).to.be.a('string');
				expect(mid).to.have.lengthOf(40);
				done();
			})
			.catch(done);
	});
});
