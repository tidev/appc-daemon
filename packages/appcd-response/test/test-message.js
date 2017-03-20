import { loadMessage } from '../src/message';

describe('message', () => {
	it('should load a message by code', () => {
		expect(loadMessage(200)).to.equal('OK');
		expect(loadMessage(400)).to.equal('Bad Request');
		expect(loadMessage(404)).to.equal('Not Found');
		expect(loadMessage(500)).to.equal('Server Error');
	});

	it('should load a message by code and subcode', () => {
		expect(loadMessage('200.1')).to.equal('Subscribed');
	});

	it('should load a message by code for invalid subcode', () => {
		expect(loadMessage('200.0')).to.equal('OK');
	});

	it('should load a message by string', () => {
		expect(loadMessage('Appc Daemon')).to.equal('Appc Daemon');
	});

	it('should return original string if not found', () => {
		expect(loadMessage('foo bar')).to.equal('foo bar');
	});
});
