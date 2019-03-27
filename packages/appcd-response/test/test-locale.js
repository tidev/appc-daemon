import { locale } from '../dist/locale';

describe('locale', () => {
	beforeEach(function () {
		this.lang = process.env.LANG;
		this.path = process.env.PATH;

		if (!this.lang) {
			process.env.LANG = 'en_US.UTF-8';
		}
	});

	afterEach(function () {
		process.env.LANG = this.lang;
		process.env.PATH = this.path;
	});

	it('should detect the system\'s locale', async () => {
		const l = await locale();
		if (l !== null) {
			expect(l).to.be.a('string');
			expect(l).to.match(/^([a-z]{2})(?:[-_](?:\w+[-_])?([A-Z]{2}))?$/i);
		}

		const l2 = await locale();
		if (l2 !== null) {
			expect(l2).to.be.a('string');
			expect(l2).to.match(/^([a-z]{2})(?:[-_](?:\w+[-_])?([A-Z]{2}))?$/i);
		}
	});

	it('should bypass the cache and gracefully handle if locale is undeterminable', async () => {
		const path = process.env.PATH;
		process.env.PATH = '';

		const before = await locale(true);
		expect(before).to.be.null;

		process.env.PATH = path;

		const after = await locale(true);
		expect(after).to.not.equal(before);
	});
});
