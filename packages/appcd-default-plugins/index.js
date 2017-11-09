const fs = require('fs');
const path = require('path');
const { dependencies } = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));
const deps = new Set(Object.keys(dependencies));
const dirs = path.resolve(__dirname).split(path.sep);

module.exports = [];

while (dirs.length) {
	const modulesDir = path.join(dirs.join(path.sep), 'node_modules');

	if (!deps.size) {
		// all done
		break;
	}

	for (const dep of deps) {
		if (dep.startsWith('appcd-plugin-')) {
			try {
				const depDir = path.join(modulesDir, dep);
				if (fs.statSync(depDir).isDirectory()) {
					module.exports.push(depDir);
					deps.delete(dep);
				}
			} catch (e) {
				// squelch
			}
		}
	}

	dirs.pop();
}
