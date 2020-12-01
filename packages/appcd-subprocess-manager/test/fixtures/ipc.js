console.log('hello from an ipc-enabled subprocess!');

process.on('message', msg => {
	console.log('got ipc message!');
	setTimeout(() => {
		console.log(msg);
		process.send('bar!');
	}, 50);
});
