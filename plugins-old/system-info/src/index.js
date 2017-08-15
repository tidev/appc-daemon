/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

console.log('hi from appcd-plugin-system-info');

module.exports = {
	activate() {
		console.log('hi from system info activate!');

		appcd.register('/square', ctx => {
			const n = parseInt(ctx.request.data.num);
			if (isNaN(n)) {
				throw new Error('Invalid number');
			}
			ctx.response = n * n;
		});
	},

	deactivate() {
		console.log('hi from system info deactivate!');
	}
};
