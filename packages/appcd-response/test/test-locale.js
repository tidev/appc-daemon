import { locale } from '../src/locale';

describe('locale', () => {
	it('should detect the system\'s locale', () => {
		const l = locale();
		if (l !== null) {
			expect(l).to.be.a.String;
			expect(l).to.match(/^([a-z]{2})(?:[-_](?:\w+[-_])?([A-Z]{2}))?$/);
		}
	});
});
