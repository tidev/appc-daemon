console.log('hello from an ipc-enabled subprocess!');

process.on('message', msg => {
	console.log('got ipc message!');
	console.log(msg);

	process.send('bar!');
});
