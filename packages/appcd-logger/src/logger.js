/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import snooplogg from 'snooplogg';

/**
 * The default appcd logger.
 * @type {SnoopLogg}
 */
const appcdLogger = snooplogg.config({
	minBrightness: 80,
	maxBrightness: 210,
	theme: 'detailed'
});

export default appcdLogger;

export { snooplogg };

export {
	createInstanceWithDefaults,
	Format,
	Logger,
	SnoopLogg,
	StdioStream,
	StripColors
} from 'snooplogg';
