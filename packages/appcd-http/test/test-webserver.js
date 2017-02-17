import path from 'path';
import WebServer from '../src/webserver';

describe('webserver', () => {
	it('should error if options is not an object', () => {
		expect(() => {
			new WebServer(123);
		}).to.throw(TypeError, 'Expected options to be an object');

		expect(() => {
			new WebServer(null);
		}).to.throw(TypeError, 'Expected options to be an object');
	});

	it('should error if hostname is not a string', () => {
		expect(() => {
			new WebServer({
				hostname: 123
			});
		}).to.throw(TypeError, 'Expected hostname to be a string');

		expect(() => {
			new WebServer({
				hostname: function () {}
			});
		}).to.throw(TypeError, 'Expected hostname to be a string');
	});

	it('should error if port is invalid', () => {
		expect(() => {
			new WebServer();
		}).to.throw(TypeError, 'Expected port to be positive integer between 1 and 65535');

		expect(() => {
			new WebServer({
				port: 'foo'
			});
		}).to.throw(TypeError, 'Expected port to be positive integer between 1 and 65535');

		expect(() => {
			new WebServer({
				port: NaN
			});
		}).to.throw(TypeError, 'Expected port to be positive integer between 1 and 65535');

		expect(() => {
			new WebServer({
				port: -123
			});
		}).to.throw(RangeError, 'Expected port to be positive integer between 1 and 65535');

		expect(() => {
			new WebServer({
				port: 123456
			});
		}).to.throw(RangeError, 'Expected port to be positive integer between 1 and 65535');
	});

	it('should error webroot is invalid', () => {
		expect(() => {
			new WebServer({
				port: 1337,
				webroot: 123
			});
		}).to.throw(TypeError, 'Expected web root directory to be a string');

		expect(() => {
			new WebServer({
				port: 1337,
				webroot: function () {}
			});
		}).to.throw(TypeError, 'Expected web root directory to be a string');

		const dir = path.join(__dirname, 'doesnotexist');
		expect(() => {
			new WebServer({
				port: 1337,
				webroot: dir
			});
		}).to.throw(Error, `Web root directory does not exist or is not a directory: ${dir}`);

		expect(() => {
			new WebServer({
				port: 1337,
				webroot: __filename
			});
		}).to.throw(Error, `Web root directory does not exist or is not a directory: ${__filename}`);
	});
});
