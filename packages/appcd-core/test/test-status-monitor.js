import StatusMonitor from '../src/status-monitor';

describe('StatusMonitor', () => {
	it('should get uptime', () => {
		const sm = new StatusMonitor;
		const uptime = sm.get(['uptime']);
		expect(uptime).to.be.a.Number;
		expect(uptime).to.be.at.least(0);
	});

	it('should fail if get() not passed an array', () => {
		expect(() => {
			const sm = new StatusMonitor;
			const uptime = sm.get('uptime');
		}).to.throw(TypeError, 'Expected filter to be an array');
	});

	it('should return null when getting non-existent status value', () => {
		const sm = new StatusMonitor;
		expect(sm.get(['foo'])).to.be.null;
		expect(sm.get(['system', 'foo'])).to.be.null;
	});

	it('should start monitoring status', function (done) {
		this.timeout(5000);
		this.slow(5000);

		const sm = new StatusMonitor;
		const uptime = sm.get(['uptime']);

		sm.start();

		setTimeout(() => {
			try {
				sm.stop();
				const uptime2 = sm.get(['uptime']);
				expect(uptime2).to.be.above(uptime);
				done();
			} catch (e) {
				done(e);
			}
		}, 2000);
	});

	// TODO: test onCall()

	// TODO: test onSubscribe()

	// TODO: test onUnsubscribe()

	// TODO: test log()
});
