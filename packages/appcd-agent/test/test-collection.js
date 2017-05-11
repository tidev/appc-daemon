import Collection from '../src/collection';

describe('collection', () => {
	it('should add values to a collection and compute stats', () => {
		const c = new Collection(5);

		c.add(5);
		expect(c.min).to.equal(5);
		expect(c.max).to.equal(5);
		expect(c.avg).to.equal(5);
		expect(Array.from(c.values)).to.deep.equal([ 5 ]);

		c.add(7);
		expect(c.min).to.equal(5);
		expect(c.max).to.equal(7);
		expect(c.avg).to.equal(6);
		expect(Array.from(c.values)).to.deep.equal([ 5, 7 ]);

		c.add(3.25);
		expect(c.min).to.equal(3.25);
		expect(c.max).to.equal(7);
		expect(c.avg).to.equal(15.25 / 3);
		expect(Array.from(c.values)).to.deep.equal([ 5, 7, 3.25 ]);

		c.add(9.99);
		expect(c.min).to.equal(3.25);
		expect(c.max).to.equal(9.99);
		expect(c.avg).to.equal((15.25 + 9.99) / 4);
		expect(Array.from(c.values)).to.deep.equal([ 5, 7, 3.25, 9.99 ]);

		c.add(0.6);
		expect(c.min).to.equal(0.6);
		expect(c.max).to.equal(9.99);
		expect(c.avg).to.equal((15.25 + 9.99 + 0.6) / 5);
		expect(Array.from(c.values)).to.deep.equal([ 5, 7, 3.25, 9.99, 0.6 ]);

		c.add(2);
		expect(c.min).to.equal(0.6);
		expect(c.max).to.equal(9.99);
		expect(c.avg).to.equal((12.25 + 9.99 + 0.6) / 5);
		expect(Array.from(c.values)).to.deep.equal([ 7, 3.25, 9.99, 0.6, 2 ]);

		c.add(7.12);
		expect(c.min).to.equal(0.6);
		expect(c.max).to.equal(9.99);
		expect(c.avg).to.equal((5.25 + 9.99 + 0.6 + 7.12) / 5);
		expect(Array.from(c.values)).to.deep.equal([ 3.25, 9.99, 0.6, 2, 7.12 ]);

		expect(c.stats).to.deep.equal({
			values: [ 3.25, 9.99, 0.6, 2, 7.12 ],
			min: 0.6,
			max: 9.99,
			avg: (5.25 + 9.99 + 0.6 + 7.12) / 5
		});
	});

	it('should error if buffer size is invalid', () => {
		expect(() => {
			new Collection('foo');
		}).to.throw(TypeError);
	});

	it('should error when adding invalid value', () => {
		const c = new Collection();

		expect(() => {
			c.add();
		}).to.throw(TypeError, 'Expected value to be a number');

		expect(() => {
			c.add(null);
		}).to.throw(TypeError, 'Expected value to be a number');

		expect(() => {
			c.add('');
		}).to.throw(TypeError, 'Expected value to be a number');

		expect(() => {
			c.add('foo');
		}).to.throw(TypeError, 'Expected value to be a number');
	});
});
