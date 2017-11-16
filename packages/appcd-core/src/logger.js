import {
	createInstanceWithDefaults,
	Format,
	StdioStream,
	StripColors
} from 'appcd-logger';

const instance = createInstanceWithDefaults()
	.snoop()
	.config({
		maxBufferSize: 500,
		minBrightness: 80,
		maxBrightness: 210,
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

export function logcat({ request, response }) {
	let formatter;
	if (!request.data || request.data.colors !== false) {
		formatter = new Format();
	} else {
		formatter = new StripColors();
	}

	formatter.pipe(response);
	instance.pipe(formatter, { flush: true });
}
