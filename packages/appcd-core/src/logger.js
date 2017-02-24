import snooplogg, { createInstanceWithDefaults, StdioStream } from 'snooplogg';

const instance = createInstanceWithDefaults()
	.snoop()
	.config({
		maxBufferSize: 250,
		theme: 'detailed'
	});

export default instance;

export { StdioStream };
