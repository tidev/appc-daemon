console.log('Hi from service');

appcd.register('/hi', ctx => {
	const os = require('os');
	ctx.response = `Hello ${os.hostname()}!`;
});
