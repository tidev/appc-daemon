import Analytics from '../dist/analytics';
import del from 'del';
import { existsSync } from '../dist/util';
import fs from 'fs';
import { HookEmitter } from 'hook-emitter';
import path from 'path';
import temp from 'temp';

class MockServer extends HookEmitter {
	constructor() {
		super();
		this.eventsDir = temp.path('appcd-test-');
	}

	config(key) {
		if (key === 'analytics.eventsDir') {
			return this.eventsDir;
		}
	}
}

describe('analytics', () => {
	beforeEach(function () {
		this.server = new MockServer;
	});

	afterEach(function (done) {
		Promise.resolve()
			.then(() => del([this.server.eventsDir], { force: true }))
			.then(() => {
				this.server = null;
				done();
			})
			.catch(done);
	});

	it('should initialize the analytics system', function (done) {
		const analytics = new Analytics(this.server);

		Promise.resolve()
			.then(analytics.init)
			.then(() => {
				expect(existsSync(analytics.eventsDir)).to.be.ok;
				done();
			})
			.catch(done);
	});

	it('should only initialize the analytics system once', function (done) {
		const analytics = new Analytics(this.server);

		Promise.resolve()
			.then(analytics.init)
			.then(() => {
				expect(existsSync(analytics.eventsDir)).to.be.ok;
				return del([analytics.eventsDir], { force: true });
			})
			.then(analytics.init)
			.then(() => {
				expect(existsSync(analytics.eventsDir)).to.not.be.ok;
				done();
			})
			.catch(done);
	});

	// this.analytics.emit('event', data);
});
