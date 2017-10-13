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
});
