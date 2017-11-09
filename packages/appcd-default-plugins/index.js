const fs = require('fs');
const path = require('path');
const { dependencies } = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));
const deps = new Set(Object.keys(dependencies).filter(n => n.startsWith('appcd-plugin-')));
const dirs = path.resolve(__dirname).split(path.sep);

module.exports = [];

while (dirs.length) {
	if (!deps.size) {
		// all done
		break;
	}

	const modulesDir = path.join(...dirs, 'node_modules');

	for (const dep of deps) {
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

	dirs.pop();
}
