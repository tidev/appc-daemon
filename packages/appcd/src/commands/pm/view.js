export default {
	aliases: [ 'v', 'info', 'show' ],
	args: [
		{
			name: 'plugin',
			hint: 'plugin[@version]',
			desc: 'the package name and version to install',
			required: true
		},
		{
			name: 'filter',
			hint: 'field[.subfield]',
			desc: 'display specific plugin fields'
		}
	],
	desc: 'display info for an appcd plugin',
	async action({ _, argv, console }) {
		console.log('view command');
		console.log(_);
		console.log(argv);
	}
};
