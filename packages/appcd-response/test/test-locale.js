import { locale } from '../dist/locale';

describe('locale', () => {
	it('should detect the system\'s locale', () => {
		const l = locale();
		if (l !== null) {
			expect(l).to.be.a.String;
			expect(l).to.match(/^([a-z]{2})(?:[-_](?:\w+[-_])?([A-Z]{2}))?$/);
		}

		const l2 = locale();
		if (l2 !== null) {
			expect(l2).to.be.a.String;
			expect(l2).to.match(/^([a-z]{2})(?:[-_](?:\w+[-_])?([A-Z]{2}))?$/);
		}
	});
});
