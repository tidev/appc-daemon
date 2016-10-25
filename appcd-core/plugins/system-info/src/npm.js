import appc from 'node-appc';
import fs from 'fs';

/**
 * Finds the NPM install directory, then watches NPM's `package.json` to see if
 * the version has changed.
 *
 * @param {Function} A function to call with NPM's version anytime NPM's
 * `package.json` is touched.
 */
export default function watch(callback) {
	Promise.resolve()
		// find npm and get the prefix
		.then(() => appc.subprocess.which(`npm${appc.subprocess.cmd}`))
		.then(npm => appc.subprocess.run(npm, ['prefix', '-g']))
		.then(({ stdout }) => stdout.split('\n')[0].replace(/^"|"$/g, ''))
		.catch(err => Promise.resolve())
		.then(npmPrefix => {
			// if we didn't find npm or the prefix, then we'll just try some
			// default paths
			if (!npmPrefix) {
				npmPrefix = process.platform === 'win32' ? '%ProgramFiles%\\Node.js' : '/usr/local';
			}

			// on Linux and OS X, the `node_modules` is inside a `lib` directory,
			// however on Windows it is not, so we're going to watch both paths
			// just to cover our bases
			const paths = [
				appc.path.expand(npmPrefix, 'lib', 'node_modules', 'npm', 'package.json'),
				appc.path.expand(npmPrefix, 'node_modules', 'npm', 'package.json')
			];

			const unwatchers = [];

			// this function is called everytime the package.json is touched
			const notify = () => {
				// we don't care which of the paths fired the FS event, we want
				// maintain precedence
				for (const path of paths) {
					if (appc.fs.isFile(path)) {
						let pkgJson;
						try {
							pkgJson = JSON.parse(fs.readFileSync(path));
						} catch (e) {
							// squeltch
						}
						if (pkgJson && pkgJson.version) {
							return callback({ version: pkgJson.version });
						}
					}
				}
				callback({ version: null });
			};

			// start watching the package.json files whether they exist or not
			for (const path of paths) {
				unwatchers.push(appc.fs.watch(path, notify));
			}

			// kick off the initial detection
			notify();

			// return a function to stop the file system watchers
			return () => {
				for (const unwatch of unwatchers) {
					unwatch();
				}
			};
		});
}
