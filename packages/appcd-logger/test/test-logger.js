import appcdLogger from '../dist/logger';
import { SnoopLogg } from 'snooplogg';

describe('appcd-logger', () => {
	it('should define the default appcd logger', () => {
		expect(appcdLogger.constructor.name).to.equal('SnoopLogg');
		expect(appcdLogger._defaultTheme).to.equal('detailed');
		expect(appcdLogger._minBrightness).to.equal(80);
		expect(appcdLogger._maxBrightness).to.equal(210);
	});
});
