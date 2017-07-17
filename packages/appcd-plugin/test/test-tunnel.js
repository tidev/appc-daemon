import Tunnel from '../dist/tunnel';

describe('Tunnel', () => {
	it('should error if proc is not a process object', () => {
		expect(() => {
			new Tunnel();
		}).to.throw(Error, 'Invalid process object');

		expect(() => {
			new Tunnel({});
		}).to.throw(Error, 'Invalid process object');

		expect(() => {
			new Tunnel(123);
		}).to.throw(Error, 'Invalid process object');
	});

	it('should error if handler is not a function', () => {
		const mockProcess = {
			send() {},
			on() {}
		};

		expect(() => {
			new Tunnel(mockProcess);
		}).to.throw(TypeError, 'Expected handler to be a function');

		expect(() => {
			new Tunnel(mockProcess, null);
		}).to.throw(TypeError, 'Expected handler to be a function');

		expect(() => {
			new Tunnel(mockProcess, {});
		}).to.throw(TypeError, 'Expected handler to be a function');
	});
});
