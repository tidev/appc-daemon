import snooplogg, { createInstanceWithDefaults, StdioStream } from 'snooplogg';

const instance = createInstanceWithDefaults()
	.snoop()
	.config({
		maxBufferSize: 250,
		theme: 'detailed'
	})
	.enable(process.env.SNOOPLOGG || process.env.DEBUG);

export default instance;

export { StdioStream };
