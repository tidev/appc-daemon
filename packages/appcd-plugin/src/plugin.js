import snooplogg from 'snooplogg';

import { isDir, isFile } from 'appcd-fs';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:manager');

export default class Plugin {
	constructor(dir) {
		if (!isDir(dir)) {
			throw new Error(`Plugin directory does not exist: ${dir}`);
		}

		/**
		 * The path to this plugin.
		 * @type {String}
		 */
		this.path = dir;

		const pkgJsonFile = path.join(subdir, 'package.json');
		if (!isFile(pkgJsonFile)) {
			throw new Error(`Plugin directory does not contain a package.json: ${dir}`);
		}

		let pkgJson;
		try {
			pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile, 'utf8'));
		} catch (e) {
			throw new Error(`Error reading plugin ${pkgJsonFile}: ${e.message}`);
		}

		if (!pkgJson.name) {
			throw new Error(`Plugin package.json doesn't have a name: ${dir}`);
		}
	}

	load() {
	}

	unload() {
	}
}
