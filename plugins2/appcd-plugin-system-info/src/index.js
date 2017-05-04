if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

console.log('hi from appcd-plugin-system');

export default class SystemInfo extends appcd.Plugin {
	constructor() {
	}
}
