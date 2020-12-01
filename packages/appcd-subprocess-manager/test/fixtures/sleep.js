setTimeout(() => {
	console.log('done!', process.pid, module.parent);
}, process.argv.length > 2 && parseInt(process.argv[2]) || 1000);
