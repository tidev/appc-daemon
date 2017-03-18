import path from 'path';

import AppcdError, { createErrorClass } from '../src/appcd-error';

describe('AppcdError', () => {
	it('should create an error without args', () => {
		const err = new AppcdError();
		expect(err.message).to.equal('Unknown Error');
		expect(err.toString()).to.equal('AppcdError: Unknown Error');
	});

	it('should create an error with a string', () => {
		const err = new AppcdError('Oh no!');
		expect(err.message).to.equal('Oh no!');
		expect(err.toString()).to.equal('AppcdError: Oh no!');
	});

	it('should create an error with a string and string args', () => {
		const err = new AppcdError('Invalid value "%s"', 'foo');
		expect(err.message).to.equal('Invalid value "foo"');
		expect(err.toString()).to.equal('AppcdError: Invalid value "foo"');
	});

	it('should create an error with a string and non-string args', () => {
		const err = new AppcdError('Invalid value: %s', ['a','b']);
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
		expect(err2.toString()).to.equal('AppcdError: Oh no! (code 500)');
	});

	it('should create an error with an error object with a code, subcode, and message', () => {
		const err = new Error('Oh no!');
		err.code = '500.123';
		const err2 = new AppcdError(err);
		expect(err2.message).to.equal('Oh no!');
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
});

describe('Custom Errors', () => {
	it('should create a custom error', () => {
		const MyError = createErrorClass('MyError');
		expect(MyError).to.be.a.function;
		expect(MyError.name).to.equal('MyError');

		const err = new MyError('Oh no!');
		expect(err).to.be.instanceof(MyError);
		expect(err.message).to.equal('Oh no!');
		expect(err.toString()).to.equal('MyError: Oh no!');
	});

	it('should fail if custom error name is invalid', () => {
		expect(() => {
			createErrorClass();
		}).to.throw(TypeError, 'Expected custom error name to be a non-empty string');

		expect(() => {
			createErrorClass(true);
		}).to.throw(TypeError, 'Expected custom error name to be a non-empty string');

		expect(() => {
			createErrorClass(function(){});
		}).to.throw(TypeError, 'Expected custom error name to be a non-empty string');
	});
});
