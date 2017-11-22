import {
	createInstanceWithDefaults,
	StdioStream,
	StripColors
} from 'appcd-logger';

const instance = createInstanceWithDefaults()
	.snoop()
	.config({
		maxBufferSize: 1000,
		minBrightness: 80,
		maxBrightness: 200,
		theme: 'detailed'
	})
	.enable('*');

if (~~process.env.APPCD_NO_COLORS) {
	// need to strip colors
	const formatter = new StripColors();
	formatter.pipe(new StdioStream());
	instance.pipe(formatter, { flush: true });
} else {
	instance.pipe(new StdioStream(), { flush: true });
}

export default instance;
