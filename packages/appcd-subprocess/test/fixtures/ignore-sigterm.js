console.log('This script cannot be killed via SIGTERM');
console.log('You must either SIGKILL, wait 10 seconds, or CTRL-C (SIGINT)\n');
console.log('PID = ' + process.pid);

process.on('SIGTERM', () => {
	console.log('Ignoring SIGTERM');
});

setTimeout(() => {
	console.log('Exiting');
}, 10000);
