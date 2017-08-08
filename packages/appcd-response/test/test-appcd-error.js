import fs from 'fs';
import path from 'path';

import AppcdError, { createErrorClass } from '../dist/appcd-error';

describe('AppcdError', () => {
	it('should create an error without args', () => {
		const err = new AppcdError();
		expect(err.message).to.equal('Unknown Error');
		expect(err.toString()).to.equal('AppcdError: Unknown Error');
		expect(err.stack).to.match(/^AppcdError:/);
	});

	it('should create an error with a string', () => {
		const err = new AppcdError('Oh no!');
		expect(err.message).to.equal('Oh no!');
		expect(err.toString()).to.equal('AppcdError: Oh no!');
		expect(err.stack).to.match(/^AppcdError:/);
	});

	it('should create an error with a string and string args', () => {
		const err = new AppcdError('Invalid value "%s"', 'foo');
		expect(err.message).to.equal('Invalid value "foo"');
		expect(err.toString()).to.equal('AppcdError: Invalid value "foo"');
	});

	it('should create an error with a string and non-string args', () => {
		const err = new AppcdError('Invalid value: %s', [ 'a', 'b' ]);
		expect(err.message).to.equal('Invalid value: ["a","b"]');
		expect(err.toString()).to.equal('AppcdError: Invalid value: ["a","b"]');
	});

	it('should create an error with an error object without a message', () => {
		const err = new AppcdError(new Error());
		expect(err.message).to.equal('Unknown Error');
		expect(err.toString()).to.equal('AppcdError: Unknown Error');
	});

	it('should create an error with an error object with a message', () => {
		const err = new AppcdError(new Error('Oh no!'));
		expect(err.message).to.equal('Oh no!');
		expect(err.toString()).to.equal('AppcdError: Oh no!');
	});

	it('should create an error with an error object with a code and message', () => {
		const err = new Error('Oh no!');
		err.code = 500;
		const err2 = new AppcdError(err);
		expect(err2.message).to.equal('Oh no!');
		expect(err2.code).to.equal(500);
		expect(err2.toString()).to.equal('AppcdError: Oh no!');
	});

	it('should create an error with an error object with a status code and message', () => {
		const err = new Error('Oh no!');
		err.statusCode = 500;
		const err2 = new AppcdError(err);
		expect(err2.message).to.equal('Oh no!');
		expect(err2.code).to.be.undefined;
		expect(err2.statusCode).to.equal(500);
		expect(err2.toString()).to.equal('AppcdError: Oh no! (code 500)');
	});

	it('should create an error with an error object with a status code, subcode, and message', () => {
		const err = new Error('Oh no!');
		err.statusCode = '500.123';
		const err2 = new AppcdError(err);
		expect(err2.message).to.equal('Oh no!');
		expect(err2.statusCode).to.equal('500.123');
		expect(err2.toString()).to.equal('AppcdError: Oh no! (code 500.123)');
	});

	it('should create an error with an AppcdError object', () => {
		const err = new AppcdError(new AppcdError('Oh no!'));
		expect(err.message).to.equal('Oh no!');
		expect(err.toString()).to.equal('AppcdError: Oh no!');
	});

	it('should create an error with a unknown code', () => {
		const err = new AppcdError(123);
		expect(err.message).to.equal('Unknown Error');
		expect(err.status).to.equal(123);
		expect(err.statusCode).to.equal(123);
		expect(err.toString()).to.equal('AppcdError: Unknown Error (code 123)');
	});

	it('should create an error with a server error code', () => {
		const err = new AppcdError(500);
		expect(err.message).to.equal('Server Error');
		expect(err.toString()).to.equal('AppcdError: Server Error (code 500)');
	});

	it('should create an error with a server error code and message', () => {
		const err = new AppcdError(500, 'Something broke');
		expect(err.message).to.equal('Something broke');
		expect(err.toString()).to.equal('AppcdError: Something broke (code 500)');
	});

	it('should create an error with a server error code, message, and args', () => {
		const err = new AppcdError(500, 'Server failed %d times due to %s', 6, 'bugs');
		expect(err.message).to.equal('Server failed 6 times due to bugs');
		expect(err.toString()).to.equal('AppcdError: Server failed 6 times due to bugs (code 500)');
	});

	it('should create an error with a unknown string code', () => {
		const err = new AppcdError('123');
		expect(err.message).to.equal('Unknown Error');
		expect(err.toString()).to.equal('AppcdError: Unknown Error (code 123)');
	});

	it('should create an error with a unknown string code and subcode', () => {
		const err = new AppcdError('123.45');
		expect(err.message).to.equal('Unknown Error');
		expect(err.toString()).to.equal('AppcdError: Unknown Error (code 123.45)');
	});

	it('should support non-string and non-code args', () => {
		const err = new AppcdError(true);
		expect(err.message).to.equal('Unknown Error: true');
		expect(err.toString()).to.equal('AppcdError: Unknown Error: true');
	});

	it('should override status and code', () => {
		const err = new AppcdError();
		expect(err.status).to.be.undefined;
		err.status = 123;
		expect(err.status).to.equal(123);
		expect(err.statusCode).to.be.undefined;
		err.statusCode = '123';
		expect(err.statusCode).to.equal('123');
	});

	it('should copy system error details', () => {
		var file = path.join(__dirname, 'does_not_exist');
		try {
			fs.statSync(file);
		} catch (e) {
			const err = new AppcdError(e);
			expect(err.status).to.be.undefined;
			expect(err.statusCode).to.be.undefined;
			expect(err.errno).to.equal(-2);
			expect(err.code).to.equal('ENOENT');
			expect(err.syscall).to.equal('stat');
			expect(err.path).to.equal(file);
			expect(err.toString()).to.match(/^AppcdError: ENOENT: no such file or directory/);
		}
	});
});

describe('Custom Errors', () => {
	it('should create a custom error', () => {
		const MyError = createErrorClass('MyError');
		expect(MyError).to.be.a('function');
		expect(MyError.name).to.equal('MyError');
		expect(MyError.codes).to.be.an('object');

		const err = new MyError('Oh no!');
		expect(err).to.be.instanceof(MyError);
		expect(err.message).to.equal('Oh no!');
		expect(err.toString()).to.equal('MyError: Oh no!');
		expect(err.stack).to.match(/^MyError:/);
	});

	it('should create a custom error with default status/code', () => {
		const MyError = createErrorClass('MyError', {
			defaultStatus: 599,
			defaultStatusCode: '599.1'
		});
		const err = new MyError(new Error('Oh no!'));
		expect(err).to.be.instanceof(MyError);
		expect(err.message).to.equal('Oh no!');
		expect(err.status).to.equal(599);
		expect(err.statusCode).to.equal('599.1');
		expect(err.toString()).to.equal('MyError: Oh no! (code 599.1)');
	});

	it('should fail if custom error name is invalid', () => {
		expect(() => {
			createErrorClass();
		}).to.throw(TypeError, 'Expected custom error class name to be a non-empty string');

		expect(() => {
			createErrorClass(true);
		}).to.throw(TypeError, 'Expected custom error class name to be a non-empty string');

		expect(() => {
			createErrorClass(function () {});
		}).to.throw(TypeError, 'Expected custom error class name to be a non-empty string');
	});

	it('should fail if options is invalid', () => {
		expect(() => {
			createErrorClass('foo', 'bar');
		}).to.throw(TypeError, 'Expected options to be an object');
	});

	it('should fail if default status is invalid', () => {
		expect(() => {
			createErrorClass('foo', { defaultStatus: 'bar' });
		}).to.throw(TypeError, 'Expected default status to be a number');
	});

	it('should fail if default code is invalid', () => {
		expect(() => {
			createErrorClass('foo', { defaultStatusCode: {} });
		}).to.throw(TypeError, 'Expected default status code to be a string or number');
	});

	it('should copy system error details', () => {
		const MyError = createErrorClass('MyError', {
			defaultStatus: 599,
			defaultStatusCode: '599.1'
		});
		var file = path.join(__dirname, 'does_not_exist');

		try {
			fs.statSync(file);
		} catch (e) {
			const err = new MyError(e);
			expect(err.status).to.equal(599);
			expect(err.statusCode).to.equal('599.1');
			expect(err.errno).to.equal(-2);
			expect(err.code).to.equal('ENOENT');
			expect(err.syscall).to.equal('stat');
			expect(err.path).to.equal(file);
			expect(err.toString()).to.match(/^MyError: ENOENT: no such file or directory/);
		}
	});
});
