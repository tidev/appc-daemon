console.log('good external plugin required');

module.exports = {
	activate() {
		console.log('hi from activate!');

		appcd.register('/square', ctx => {
			return appcd.call('/appcd/config/home')
				.then(({ response }) => {
					console.log('appcd home =', response);

					const n = parseInt(ctx.request.data.num);
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
