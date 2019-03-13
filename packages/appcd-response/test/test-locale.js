import { locale } from '../dist/locale';

describe('locale', () => {
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
		const p = process.env.PATH;
		process.env.PATH = '';
		let before;

		try {
			before = await locale(true);
		} finally {
			process.env.PATH = p;
		}

		expect(before).to.be.null;

		const after = await locale(true);
		expect(after).to.not.equal(before);
	});
});
