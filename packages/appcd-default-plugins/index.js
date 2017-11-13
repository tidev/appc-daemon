const fs = require('fs');
const path = require('path');
const { dependencies } = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));
const deps = new Set(Object.keys(dependencies).filter(n => n.startsWith('appcd-plugin-')));
let modulesDir = __dirname;
let lastDir = null;

module.exports = [];

function isDir(dir) {
	try {
		return fs.statSync(dir).isDirectory();
	} catch (e) {
		return false;
	}
}

while (modulesDir !== lastDir) {
	if (!deps.size) {
		// all done
		break;
	}

	for (const dep of deps) {
		let depDir = path.join(modulesDir, 'node_modules', dep);
		if (isDir(depDir) || isDir(depDir = path.join(modulesDir, dep))) {
			module.exports.push(depDir);
			deps.delete(dep);
		}
	}

	lastDir = modulesDir;
	modulesDir = path.dirname(modulesDir);
}
