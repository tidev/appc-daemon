import { i18n, loadMessage } from '../dist/message';

describe('message', () => {
	it('should load a message by code', () => {
		expect(loadMessage(200)).to.equal('OK');
		expect(loadMessage(400)).to.equal('Bad Request');
		expect(loadMessage(404)).to.equal('Not Found');
		expect(loadMessage(500)).to.equal('Server Error');
	});

	it('should load a message by code and subcode', () => {
		expect(loadMessage('201.1')).to.equal('Subscribed');
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

	it('should load a locale specific message', () => {
		expect(loadMessage('Appc Daemon', 'es-ES')).to.equal('Appc Daemon');
	});

	it('should create localized i18n functions', () => {
		const { __, __n } = i18n();

		expect(__('foo')).to.equal('foo');
		expect(__('foo %s', 'bar')).to.equal('foo bar');

		expect(__n(1, 'foo', 'bar')).to.equal('foo');
		expect(__n(2, 'foo', 'bar')).to.equal('bar');

		expect(__n(1, '%s foo', '%s bar')).to.equal('1 foo');
		expect(__n(2, '%s foo', '%s bar')).to.equal('2 bar');

		expect(__n(1, '%s foo %%s', '%s bar %%s', 'baz')).to.equal('1 foo baz');
		expect(__n(2, '%s foo %%s', '%s bar %%s', 'baz')).to.equal('2 bar baz');

		expect(__n(1, '', '%s bar %%s', 'baz')).to.equal('');
		expect(__n(2, '', '%s bar %%s', 'baz')).to.equal('2 bar baz');
	});
});
