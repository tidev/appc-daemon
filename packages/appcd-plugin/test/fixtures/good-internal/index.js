console.log('good internal plugin required');

module.exports = {
	activate() {
		console.log('hi from activate!');

		appcd.register('/square', ctx => {
			return appcd.call('/appcd/config/home')
				.then(result => {
					console.log('appcd home = ' + result.response);

					const n = parseInt(ctx.request.num);
					if (isNaN(n)) {
						throw new Error('Invalid number');
					}
					ctx.response = n * n;
				});
		});
	},

	deactivate() {
		console.log('hi from deactivate!');
	}
};
