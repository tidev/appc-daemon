import snooplogg from 'snooplogg';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:plugin');
const { highlight } = snooplogg.styles;

export default class Plugin {
	constructor() {
		//
	}

	init() {
	}

	shutdown() {
	}
}
