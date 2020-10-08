const fs = require('fs-extra');
const path = require('path');
let dir = process.argv[2];

if (!dir) {
	console.error('Missing dir argument');
	process.exit(1);
}

fs.mkdirsSync(dir);

// setTimeout(() => {
	for (const name of [ 'c', 'd', 'e', 'f', 'g' ]) {
		dir = path.join(dir, name);
		console.log(`Creating ${dir}`);
		fs.mkdirSync(dir);
	}
// }, 500);
