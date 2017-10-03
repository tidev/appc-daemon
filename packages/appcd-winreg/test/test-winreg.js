import * as winreg from '../dist/winreg';

const _it = (process.platform === 'win32' ? it : it.skip);

describe('winreg', () => {

	describe('Platform', () => {
		afterEach(() => {
			delete process.env.APPCD_TEST_PLATFORM;
		});

		it('should return null if not running on Windows', () => {
			process.env.APPCD_TEST_PLATFORM = 'darwin';

			return winreg.get()
				.then(result => {
					expect(result).to.be.null;
				});
		});
	});

	describe('get()', () => {
		_it('should get an existing key', () => {
			return winreg.get('HKLM', 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', 'ProductName')
				.then(value => {
					expect(value).to.be.a('string');
					expect(value).to.not.equal('');
				});
		});

		_it('should handle non-existent key', () => {
			return winreg.get('HKLM', 'SOFTWARE\\DoesNotExist', 'DoesNotExist')
				.then(() => {
					throw new Error('Expected error');
				}, err => {
					expect(err.code).to.equal(1);
					expect(err.message).to.equal('QUERY command exited with code 1:\n\nERROR: The system was unable to find the specified registry key or value.');
				});
		});

		_it('should handle non-existent key value', () => {
			return winreg.get('HKLM', 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', 'DoesNotExist')
				.then(() => {
					throw new Error('Expected error');
				}, err => {
					expect(err.code).to.equal(1);
					expect(err.message).to.equal('QUERY command exited with code 1:\n\nERROR: The system was unable to find the specified registry key or value.');
				});
		});

		_it('should reject if hive is invalid', () => {
			return winreg.get(null)
				.then(() => {
					throw new Error('Expected error');
				}, err => {
					expect(err).to.be.instanceof(TypeError);
					expect(err.message).to.equal('Expected hive to be a non-empty string');
				});
		});

		_it('should reject if hive is unknown type', () => {
			return winreg.get('foo')
				.then(() => {
					throw new Error('Expected error');
				}, err => {
					expect(err).to.be.instanceof(Error);
					expect(err.message).to.equal('Invalid hive "foo", must be "HKLM", "HKCU", "HKCR", "HKU", or "HKCC"');
				});
		});

		_it('should reject if key is invalid', () => {
			return winreg.get('HKLM', null)
				.then(() => {
					throw new Error('Expected error');
				}, err => {
					expect(err).to.be.instanceof(TypeError);
					expect(err.message).to.equal('Expected key to be a non-empty string');
				});
		});

		_it('should reject if name is invalid', () => {
			return winreg.get('HKLM', 'foo', null)
				.then(() => {
					throw new Error('Expected error');
				}, err => {
					expect(err).to.be.instanceof(TypeError);
					expect(err.message).to.equal('Expected name to be a non-empty string');
				});
		});
	});

	describe('keys()', () => {
		_it('should get all subkeys', () => {
			return winreg.keys('HKLM', 'SOFTWARE\\Microsoft\\Windows NT')
				.then(keys => {
					expect(keys).to.be.an('array');
					expect(keys).to.include('\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion');
				});
		});

		_it('should handle non-existent key', () => {
			return winreg.keys('HKLM', 'SOFTWARE\\DoesNotExist')
				.then(keys => {
					expect(keys).to.be.an('array');
					expect(keys).to.have.lengthOf(0);
				});
		});
	});
});
