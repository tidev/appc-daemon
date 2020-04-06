export default {
	aliases: [ 'un', 'unlink', 'r', 'rm', 'remove' ],
	args: [
		{
			name: 'plugin',
			hint: 'plugin[@version]',
			desc: 'the plugin name and version to uninstall',
			required: true
		}
	],
	desc: 'uninstall a plugin',
	async action({ _, argv, console }) {
		console.log('uninstall command');
		console.log(_);
		console.log(argv);
	}
};
