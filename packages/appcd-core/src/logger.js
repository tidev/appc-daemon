import snooplogg, { createInstanceWithDefaults, Format, StdioStream } from 'snooplogg';

const instance = createInstanceWithDefaults()
	.snoop()
	.config({
		maxBufferSize: 250,
		theme: 'detailed'
	})
	.enable(process.env.SNOOPLOGG || process.env.DEBUG);

export default instance;

export { StdioStream };

export function logcat(stream) {
	const formatter = new Format();
	instance.pipe(formatter, { flush: true });
	formatter.pipe(stream);
}
