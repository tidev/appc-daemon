export default {
	aliases: [ 'up' ],
	args: [
		{
			name: 'plugin',
			desc: 'The plugin name to update or blank for all'
		}
	],
	desc: 'Check and install plugin updates',
	async action({ _, argv, console }) {
		console.log('update command');
		console.log(_);
		console.log(argv);
	}
};
