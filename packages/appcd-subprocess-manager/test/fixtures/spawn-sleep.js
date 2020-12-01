const path = require('path');
const spawn = require('child_process').spawn;
const child = spawn(process.execPath, [
	path.join(__dirname, 'sleep.js'),
	process.argv.length > 2 && parseInt(process.argv[2]) || 1000
]);
console.log(child.pid);
