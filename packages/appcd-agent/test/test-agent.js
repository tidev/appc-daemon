import Agent from '../dist/index';

describe('agent', () => {
	describe('poll', () => {
		beforeEach(function () {
			this.agent = new Agent();
		});

		afterEach(function () {
			this.agent.stop();
			this.agent = null;
		});

		it('should start polling and emit stats', function (done) {
			this.agent
				.on('stats', stats => {
					try {
						expect(stats).to.be.an.Object;

						expect(stats).to.have.property('cpu');
						expect(stats.cpu).to.be.a.Number;

						expect(stats).to.have.property('freemem');
						expect(stats.freemem).to.be.a.Number;

						expect(stats).to.have.property('heapTotal');
						expect(stats.heapTotal).to.be.a.Number;

						expect(stats).to.have.property('heapUsed');
						expect(stats.heapUsed).to.be.a.Number;

						expect(stats).to.have.property('rss');
						expect(stats.rss).to.be.a.Number;

						done();
					} catch (e) {
						done(e);
					}
				})
				.on('error', err => done(err))
				.start();
		});

		it('should start polling custom collector', function (done) {
			this.agent
				.addCollector(() => {
					return {
						foo: 5,
						bar: 10
					};
				})
				.on('stats', stats => {
					try {
						expect(stats).to.be.an.Object;

						expect(stats).to.have.property('cpu');
						expect(stats.cpu).to.be.a.Number;

						expect(stats).to.have.property('freemem');
						expect(stats.freemem).to.be.a.Number;

						expect(stats).to.have.property('heapTotal');
						expect(stats.heapTotal).to.be.a.Number;

						expect(stats).to.have.property('heapUsed');
						expect(stats.heapUsed).to.be.a.Number;

						expect(stats).to.have.property('rss');
						expect(stats.rss).to.be.a.Number;

						expect(stats).to.have.property('foo');
						expect(stats.foo).to.equal(5);

						expect(stats).to.have.property('bar');
						expect(stats.bar).to.equal(10);

						done();
					} catch (e) {
						done(e);
					}
				})
				.on('error', err => done(err))
				.start();
		});

		it('should remove custom collector', function (done) {
			this.timeout(7000);
			this.slow(6000);

			const collector = () => {
				return {
					foo: 10
				};
			};

			let counter = 0;

			this.agent
				.addCollector(collector)
				.on('stats', stats => {
					try {
						if (++counter === 1) {
							expect(stats).to.have.property('foo');
							this.agent.removeCollector(collector);
						} else {
							expect(this.agent.collectors).to.have.lengthOf(0);
							expect(stats).to.not.have.property('foo');
							done();
						}
					} catch (e) {
						done(e);
					}
				})
				.on('error', err => done(err))
				.start();
		});

		it('should start polling for 4 seconds and get stats', function (done) {
			this.timeout(10000);
			this.slow(8000);

			let counter = 1;

			this.agent
				.addCollector(() => new Promise((resolve, reject) => {
					setImmediate(() => {
						resolve({
							foo: counter++
						});
					});
				}))
				.on('stats', stats => {
					if (counter > 4) {
						this.agent.stop();

						try {
							const fooStats = this.agent.getStats('foo');
							expect(fooStats).to.deep.equal({
								values: [ 1, 2, 3, 4 ],
								min: 1,
								max: 4,
								avg: 2.5
							});

							done();
						} catch (e) {
							done(e);
						}
					}
				})
				.on('error', err => done(err))
				.start();
		});

		it('should interpolate missing values', function (done) {
			this.timeout(10000);
			this.slow(8000);

			let counter = 1;

			this.agent
				.addCollector(() => new Promise((resolve, reject) => {
					setTimeout(() => {
						resolve({
							foo: counter++
						});
					}, counter === 1 ? 0 : 2500);
				}))
				.on('stats', stats => {
					if (counter === 3) {
						this.agent.stop();

						try {
							const fooStats = this.agent.getStats('foo');
							expect(fooStats.min).to.equal(1);
							expect(fooStats.max).to.equal(2);
							expect(fooStats.avg).to.equal(1.5);

							expect(fooStats.values).to.have.length(4);
							expect(fooStats.values[0]).to.equal(1);
							expect(Math.floor(fooStats.values[1] * 1e6)).to.equal(1333333);
							expect(Math.floor(fooStats.values[2] * 1e6)).to.equal(1666666);
							expect(fooStats.values[3]).to.equal(2);

							done();
						} catch (e) {
							done(e);
						}
					}
				})
				.on('error', err => done(err))
				.start();
		});

		it('should return null if stats bucket doesn\'t exist', function (done) {
			this.agent
				.on('stats', stats => {
					try {
						const badStats = this.agent.getStats('foo');
						expect(badStats).to.be.null;

						done();
					} catch (e) {
						done(e);
					}
				})
				.on('error', err => done(err))
				.start();
		});

		it('should emit error if error during polling', function (done) {
			this.agent
				.addCollector(() => {
					throw new Error('Oh no!');
				})
				.on('error', err => {
					try {
						expect(err.message).to.equal('Oh no!');
						done();
					} catch (e) {
						done(e);
					}
				})
				.start();
		});
	});

	describe('errors', () => {
		it('should error if options is not an object', () => {
			expect(() => {
				new Agent('foo');
			}).to.throw(TypeError, 'Expected options to be an object');

			expect(() => {
				new Agent(123);
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if collector is not a function', () => {
			const agent = new Agent;

			expect(() => {
				agent.addCollector();
			}).to.throw(TypeError, 'Expected collector to be a function');

			expect(() => {
				agent.addCollector('foo');
			}).to.throw(TypeError, 'Expected collector to be a function');

			expect(() => {
				agent.removeCollector();
			}).to.throw(TypeError, 'Expected collector to be a function');

			expect(() => {
				agent.removeCollector('foo');
			}).to.throw(TypeError, 'Expected collector to be a function');
		});
	});
});
