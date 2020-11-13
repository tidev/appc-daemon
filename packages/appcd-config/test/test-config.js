import AppcdConfig from '../dist/config';

describe('AppcdConfig', () => {
	it('should error if options is invalid', () => {
		expect(() => {
			new AppcdConfig(null);
		}).to.throw(TypeError, 'Expected options to be an object');

		expect(() => {
			new AppcdConfig(123);
		}).to.throw(TypeError, 'Expected options to be an object');
	});

	it('should create a new config instance', () => {
		const cfg = new AppcdConfig();
		cfg.set('foo', 'bar');
		expect(cfg.get('foo')).to.equal('bar');
		expect(cfg.toString()).to.equal([
			'{',
			'  "Symbol(base)": {},',
			'  "Symbol(user)": {',
			'    "foo": "bar"',
			'  },',
			'  "Symbol(runtime)": {',
			'    "foo": "bar"',
			'  }',
			'}'
		].join('\n'));
	});
});
