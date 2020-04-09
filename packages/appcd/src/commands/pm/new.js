export default {
	args: [
		{
			name: 'name',
			desc: 'the plugin name'
		}
	],
	desc: 'create a new plugin project',
	async action({ _, argv, console }) {
		console.log('new command');
		console.log(_);
		console.log(argv);

		// template-kit!
	}
};
