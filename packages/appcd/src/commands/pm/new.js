export default {
	args: [
		{
			name: 'name',
			desc: 'The plugin name'
		}
	],
	desc: 'Create a new plugin project',
	async action({ _, argv, console }) {
		console.log('new command');
		console.log(_);
		console.log(argv);

		// template-kit!
	}
};
