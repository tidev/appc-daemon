import Handle from '../dist/handle';

describe('Detect Handle', () => {
	it('should unwatch all watchers', () => {
		const w = new Handle();
		const unwatch = sinon.spy();
		w.unwatchers.set('foo', unwatch);
		w.stop();
		w.stop();
		expect(unwatch.calledOnce);
	});
});
