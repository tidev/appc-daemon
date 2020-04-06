export default {
	aliases: [ 'ls' ],
	desc: 'lists all installed plugins',
	async action({ _, argv, console }) {
		console.log('list command');
		console.log(_);
		console.log(argv);
	}
};
