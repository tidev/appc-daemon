import fs from 'fs-extra';
import path from 'path';
import temp from 'temp';

import { getMachineId } from '../src/machine-id';

temp.track();

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
				expect(mid).to.be.a.String;
				expect(mid).to.have.lengthOf(40);
				done();
			})
			.catch(done);
	});

	it('should load mid from a file', done => {
		// NOTE: the mid in good.mid is valid, but because it won't match the
		// detected machine's id, it will be overwritten by the real one
		const tmp = temp.mkdirSync('appcd-machine-id-test-');
		const file = path.join(tmp, 'good.mid');
		fs.copySync(path.join(__dirname, 'fixtures', 'good.mid'), file);

		getMachineId(file)
			.then(mid => {
				expect(mid).to.be.a.String;
				expect(mid).to.have.lengthOf(40);
				expect(mid).to.equal(fs.readFileSync(file, 'utf8').split('\n')[0]);
				done();
			})
			.catch(done);
	});

	it('should be ok if mid file is empty', done => {
		const tmp = temp.mkdirSync('appcd-machine-id-test-');
		const file = path.join(tmp, 'empty.mid');
		fs.copySync(path.join(__dirname, 'fixtures', 'empty.mid'), file);

		getMachineId(file)
			.then(mid => {
				expect(mid).to.be.a.String;
				expect(mid).to.have.lengthOf(40);
				expect(mid).to.equal(fs.readFileSync(file, 'utf8').split('\n')[0]);
				done();
			})
			.catch(done);
	});

	it('should be ok if mid file is bad', done => {
		const tmp = temp.mkdirSync('appcd-machine-id-test-');
		const file = path.join(tmp, 'bad.mid');
		fs.copySync(path.join(__dirname, 'fixtures', 'bad.mid'), file);

		getMachineId(file)
			.then(mid => {
				expect(mid).to.be.a.String;
				expect(mid).to.have.lengthOf(40);
				expect(mid).to.equal(fs.readFileSync(file, 'utf8').split('\n')[0]);
				done();
			})
			.catch(done);
	});

	it('should be ok if mid file does not exist', done => {
		const tmp = temp.mkdirSync('appcd-machine-id-test-');
		const file = path.join(tmp, 'test.mid');

		getMachineId(file)
			.then(mid => {
				expect(mid).to.be.a.String;
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
				expect(mid).to.be.a.String;
				expect(mid).to.have.lengthOf(40);
				done();
			})
			.catch(done);
	});
});
