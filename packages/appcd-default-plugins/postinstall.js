const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const pacote = require('pacote');
const semver = require('semver');
const which = require('which');
const { spawnSync } = require('child_process');
const { plugins } = require('./package.json');

(async () => {
	try {
		const npmClient = which.sync('yarn', { nothrow: true }) ? 'yarn' : 'npm';
		const pluginsDir = path.join(os.homedir(), '.appcelerator/appcd/plugins');
		const packagesDir = path.join(pluginsDir, 'packages');
		const workspaces = [];

		console.log(`Using ${npmClient} client`);

		fs.mkdirsSync(packagesDir);

		// find lerna
		let lerna;
		for (let cur = __dirname, last = null; cur !== last; last = cur, cur = path.dirname(cur)) {
			if (fs.existsSync(lerna = path.join(cur, 'node_modules', '.bin', 'lerna'))) {
				console.log(`Found lerna: ${path.relative(path.dirname(__dirname), lerna)}`);
				break;
			}
		}
		if (!lerna) {
			throw new Error('Unable to find lerna, run "npm install"');
		}

		// loop over every plugin until we find
		for (const [ name, versions ] of Object.entries(plugins)) {
			for (const spec of versions) {
				try {
					// check for a local yarn link first
					const linkDir = path.join(os.homedir(), '.config', 'yarn', 'link', name);
					const { version } = fs.readJsonSync(path.join(linkDir, 'package.json'));
					const dir = path.join(packagesDir, name, version);
					if (semver.satisfies(version, spec)) {
						if (!fs.existsSync(dir) || fs.realpathSync(linkDir) !== fs.realpathSync(dir)) {
							console.log(`Linking ${linkDir} => ${path.relative(path.dirname(__dirname), dir)}`);
							fs.removeSync(dir);
							fs.mkdirsSync(path.dirname(dir));
							fs.symlinkSync(linkDir, dir, 'dir');
						} else {
							console.log(`Already linked ${linkDir} => ${path.relative(path.dirname(__dirname), dir)}`);
						}
						continue;
					}
				} catch (e) {
					// squelch
				}

				let manifest;

				try {
					// call out to npm
					manifest = await pacote.manifest(`${name}@${spec}`);
				} catch (e) {
					console.error(`Failed to find required appcd plugin: ${name}@${spec}:`);
					console.error(e);
					process.exit(1);
				}

				const dir = path.join(packagesDir, name, manifest.version);

				try {
					const realDir = fs.realpathSync(dir);
					const { version } = await fs.readJsonSync(path.join(realDir, 'package.json'));
					if (version === manifest.version) {
						console.log(`${name}@${ver} already installed`);
						continue;
					}
				} catch (e) {
					// directory does not exist or doesn't have a package.json
				}

				workspaces.push(`packages/${name}/${manifest.version}`);

				console.log(`Downloading ${name}@${manifest.version}`);
				await pacote.extract(`${name}@${manifest.version}`, dir);
			}
		}

		const pkgJson = {
			name: 'root',
			private: true,
			version: '0.0.0'
		};
		const lernaJson = {
			npmClient,
			npmClientArgs: [ '--production' ],
			version: 'independent'
		};
		const lernaArgs = [ lerna, 'bootstrap' ];

		if (npmClient === 'yarn') {
			pkgJson.workspaces = workspaces;
			lernaJson.npmClientArgs.push('--no-lockfile');
			lernaJson.useWorkspaces = true;
		} else {
			lernaJson.npmClientArgs.push('--no-package-lock');
			lernaJson.packages = workspaces;
			lernaArgs.push('--hoist');
		}

		console.log('Writing plugins/package.json');
		fs.writeFileSync(path.join(pluginsDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

		console.log('Writing plugins/lerna.json');
		fs.writeFileSync(path.join(pluginsDir, 'lerna.json'), JSON.stringify(lernaJson, null, 2));

		console.log('Running lerna bootstrap...');
		spawnSync(process.execPath, lernaArgs, { cwd: pluginsDir, stdio: 'inherit' });
		console.log('appcd-default-plugins install complete');
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
})();
