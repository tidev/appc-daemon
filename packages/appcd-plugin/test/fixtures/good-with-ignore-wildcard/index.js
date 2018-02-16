console.log('good external plugin required');
let counter = 0;

module.exports = {
	activate() {
		appcd.register('/counter', ctx => {
			counter++;
			ctx.response = counter;
		});
	},

	deactivate() {
		console.log('hi from deactivate!');
	}
};
