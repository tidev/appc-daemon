export default {
	aliases: [ 'up' ],
	args: [
		{
			name: 'plugin',
			desc: 'the plugin name to update'
		}
	],
	desc: 'check and install plugin updates',
	async action({ _, argv, console }) {
		console.log('update command');
		console.log(_);
		console.log(argv);
	}
};
