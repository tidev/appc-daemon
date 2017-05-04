if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

console.log('hi from appcd-plugin-appc-cli');

export default class AppcCLI extends appcd.Plugin {
	constructor() {
	}
}
