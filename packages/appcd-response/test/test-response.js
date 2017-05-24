import Response from '../dist/response';

import { codes } from '../dist/codes';

describe('Response', () => {
	it('should create a message without a default format', () => {
		const msg = new Response({}, 'foo', 'bar');
		expect(msg.format).to.be.undefined;
		expect(msg.toString()).to.equal('{} foo bar');
	});

	it('should create a message without a default format or message', () => {
		const msg = new Response(null, 'foo', 'bar');
		expect(msg.format).to.be.undefined;
		expect(msg.toString()).to.equal('null foo bar');
	});

	it('should return empty string if no message', () => {
		const msg = new Response();
		expect(msg.toString()).to.equal('');
	});

	it('should return empty string if message is an empty string', () => {
		const msg = new Response('');
		expect(msg.toString()).to.equal('');
	});

	it('should return empty string if message and args is an empty string', () => {
		const msg = new Response('', '');
		expect(msg.toString()).to.equal('');
	});

	it('should return status message even if status is overwritten', () => {
		const msg = new Response(codes.OK);
		msg.status = null;
		expect(msg.status).to.be.undefined;
		expect(msg.statusCode).to.equal(200);
		expect(msg.toString()).to.equal('OK');
	});
});
