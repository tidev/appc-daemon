import {
	defaultConfig,
	makeTest,
	stripColors
} from './common';

describe('appcd start', function () {
	this.timeout(120000);

	describe('help', () => {
		it('should output help as JSON', makeTest(async function () {
			const { status, stdout } = this.runAppcdSync([ 'start', '--help', '--json' ]);
			expect(status).to.equal(2);
			expect(JSON.parse(stdout).desc).to.equal('Starts the Appc Daemon if it\'s not already running');
		}));
	});

	it('should start the daemon with the default config', makeTest(async function () {
		await this.installNode();
		const { status, stdout } = this.startDaemonSync(defaultConfig);
		expect(status).to.equal(0);
		expect(stripColors(stdout.toString())).to.match(/^Appcelerator Daemon, version \d+\.\d+\.\d+\nCopyright \(c\) 2015-\d{4}, Axway, Inc\. All Rights Reserved\.\n\nAppc Daemon started\n$/);
	}));

	// TODO: debug mode
});
