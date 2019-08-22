import {
	makeTest,
	stripColors
} from './common';

describe('appcd stop', function () {
	this.timeout(60000);

	describe('help', () => {
		it('should output help as JSON', makeTest(async function () {
			const { status, stdout } = this.runAppcdSync([ 'stop', '--help', '--json' ]);
			expect(status).to.equal(2);
			expect(JSON.parse(stdout).desc).to.equal('Stops the Appc Daemon if running');
		}));
	});

	it('should not need to stop the daemon if not running', makeTest(async function () {
		await this.installNode();
		const { status, stdout } = this.runAppcdSync([ 'stop' ]);
		expect(status).to.equal(3);
		expect(stripColors(stdout.toString())).to.match(/^Appcelerator Daemon, version \d+\.\d+\.\d+\nCopyright \(c\) 2015-\d{4}, Axway, Inc\. All Rights Reserved\.\n\nAppc Daemon already stopped\n$/);
	}));
});
