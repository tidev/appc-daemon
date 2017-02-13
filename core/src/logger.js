import snooplogg from 'snooplogg';

const instance = snooplogg.config({
	maxBufferSize: 250,
	theme: 'detailed'
});
const logger = instance('appcd');

export default logger;

export { instance as snooplogg };
