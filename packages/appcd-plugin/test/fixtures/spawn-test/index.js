const path = require('path');

module.exports = {
	activate() {
		appcd.register('/spawn', async ctx => {
			const { response } = await appcd.call('/appcd/subprocess/spawn/node', {
				data: {
					args: [ path.join(__dirname, 'bin', 'spawn-test.js') ]
				}
			});
			response.pipe(ctx.response);
		});
	}
};
