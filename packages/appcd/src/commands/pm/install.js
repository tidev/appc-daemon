export default {
	aliases: [ 'i' ],
	args: [
		{
			name: 'plugin',
			hint: 'plugin[@version]',
			desc: 'the plugin name and version to install',
			required: true
		}
	],
	desc: 'install an appcd plugin',
	async action({ _, argv, console }) {
		console.log('install command');
		console.log(_);
		console.log(argv);
	}
};
