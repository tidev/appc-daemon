import Dispatcher from '../src/dispatcher';
import ServiceDispatcher from '../src/service-dispatcher';

describe('ServiceDispatcher', () => {
	it('should fail if path is invalid', () => {
		expect(() => {
			new ServiceDispatcher();
		}).to.throw(TypeError, 'Expected path to be a string');

		expect(() => {
			new ServiceDispatcher('');
		}).to.throw(TypeError, 'Expected path to be a string');

		expect(() => {
			new ServiceDispatcher(123);
		}).to.throw(TypeError, 'Expected path to be a string');
	});
});
