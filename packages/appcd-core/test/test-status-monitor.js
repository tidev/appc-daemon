import Config from 'appcd-config';
import StatusMonitor from '../dist/status-monitor';

const config = new Config();

describe('StatusMonitor', () => {
	it('should throw exception if config not passed in', () => {
		expect(() => {
			new StatusMonitor();
		}).to.throw(TypeError, '');
	});

	it('should get uptime', () => {
		const sm = new StatusMonitor(config);
		const uptime = sm.get([ 'uptime' ]);
		expect(uptime).to.be.a('number');
		expect(uptime).to.be.at.least(0);
	});

	it('should return null when getting non-existent status value', () => {
		const sm = new StatusMonitor(config);
		expect(sm.get([ 'foo' ])).to.be.null;
		expect(sm.get([ 'system', 'foo' ])).to.be.null;
	});

	it('should start monitoring status', function (done) {
		this.timeout(5000);
		this.slow(5000);

		const sm = new StatusMonitor(config);
		const uptime = sm.get([ 'uptime' ]);

		sm.start();

		setTimeout(() => {
			try {
				sm.shutdown();
				const uptime2 = sm.get([ 'uptime' ]);
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
