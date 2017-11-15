import { createInstanceWithDefaults, Format, StdioStream, StripColors } from 'appcd-logger';

const instance = createInstanceWithDefaults()
	.snoop()
	.config({
		maxBufferSize: 500,
		minBrightness: 80,
		maxBrightness: 210,
		theme: 'detailed'
	})
	.enable(process.env.SNOOPLOGG || process.env.DEBUG);

export default instance;

export { StdioStream };

export function logcat(request, response) {
	let formatter;
	if (!request.data || request.data.colors !== false) {
		formatter = new Format();
	} else {
		formatter = new StripColors();
	}

	formatter.pipe(response);
	instance.pipe(formatter, { flush: true });
}
