import snooplogg from 'snooplogg';
import fs from 'fs-extra';
import globule from 'globule';
import os from 'os';
import pacote from 'pacote';
import path from 'path';
import semver from 'semver';

import { spawn } from 'child_process';

const logger = snooplogg('appcd:default-plugins');
const { highlight } = snooplogg.styles;

/**
 * Ensures the default appcd plugins are installed.
 *
 * @param {String} pluginsDir - Path to the plugins directory.
 * @returns {Promise}
 */
export async function installDefaultPlugins(pluginsDir) {
	const start = new Date();

	if (!pluginsDir || typeof pluginsDir !== 'string') {
		throw new TypeError('Expected plugins directory to be a non-empty string');
	}

	const packagesDir = path.join(pluginsDir, 'packages');

	// check that we can write to the plugins dir
	try {
		// make sure the plugins/packages directory exists
		await fs.mkdirs(packagesDir);

		const testFile = path.join(packagesDir, `test_${Date.now()}.txt`);
		fs.writeFileSync(testFile, 'delete me');
		await fs.remove(testFile);
	} catch (e) {
		const err = new Error(e.code === 'EACCES'
			? 'Could not write to plugins directory'
			: `Error initializing plugins directory: ${e.message}`);
		err.code = e.code;
		throw err;
	}

	// find yarn and lerna
	const yarn = find('yarn');
	if (yarn) {
		logger.log(`Found yarn: ${highlight(yarn)}`);
	} else {
		logger.error('Unable to find yarn bin, skipping install default plugins');
		return;
	}

	const lerna = find('lerna');
	if (lerna) {
		logger.log(`Found lerna: ${highlight(lerna)}`);
	} else {
		logger.error('Unable to find lerna bin, skipping install default plugins');
		return;
	}

	const linksDir = process.platform === 'win32'
		? path.join(os.homedir(), 'AppData', 'Local', 'Yarn', 'Data', 'link')
		: path.join(os.homedir(), '.config', 'yarn', 'link');
	const { plugins } = await fs.readJson(path.resolve(__dirname, '..', 'package.json'));
	const installed = {};
	const install = [];
	const newWorkspaces = new Set();
	let existingWorkspaces = new Set();

	try {
		existingWorkspaces = new Set((await fs.readJson(path.join(pluginsDir, 'package.json'))).workspaces);
	} catch (e) {
		// does not exist or bad
	}

	const cleanup = (src, invalidDest, msg) => {
		if (fs.lstatSync(src).isSymbolicLink()) {
			logger.warn(`${msg}, unlinking...`);
			fs.unlinkSync(src);
		} else {
			logger.warn(`${msg}, invalidating...`);
			fs.moveSync(src, invalidDest, { overwrite: true });
		}
	};

	// determine what packages are already installed
	for (const rel of globule.find('*/*/package.json', '@*/*/*/package.json', { srcBase: packagesDir })) {
		const pkgJsonFile = path.join(packagesDir, rel);
		const src = path.dirname(pkgJsonFile);
		const invalidDest = path.join(pluginsDir, 'invalid', path.dirname(rel));
		let name, version;

		try {
			({ name, version } = await fs.readJson(pkgJsonFile));
		} catch (e) {
			cleanup(src, invalidDest, 'Bad package.json');
			continue;
		}

		const nameDir = path.dirname(path.dirname(rel));
		const versionDir = path.basename(src);

		if (name !== nameDir) {
			cleanup(src, invalidDest, `Plugin directory name mismatch: ${highlight(`${name}@${version}`)} found in ${highlight(nameDir)}`);
		} else if (version !== versionDir) {
			cleanup(src, invalidDest, `Plugin directory version mismatch: ${highlight(`${name}@${version}`)} found in ${highlight(versionDir)}`);
		} else {
			logger.log(`Found installed plugin ${highlight(`${name}@${version}`)}`);
			if (!installed[name]) {
				installed[name] = {};
			}
			installed[name][version] = path.dirname(pkgJsonFile);
			newWorkspaces.add(`packages/${name}/${version}`);
		}
	}

	// detect any existing yarn links
	for (const rel of globule.find('*/package.json', '@*/*/package.json', { srcBase: linksDir })) {
		const pkgJsonFile = path.join(linksDir, rel);
		let appcd, name, version;

		try {
			({ appcd, name, version } = await fs.readJson(pkgJsonFile));
		} catch (e) {
			logger.warn(`Failed to parse link package.json: ${pkgJsonFile}`);
		}

		if (appcd && (!appcd.os || appcd.os.includes(process.platform))) {
			const linkPath = path.dirname(pkgJsonFile);

			if (!installed[name]) {
				installed[name] = {};
			}
			if (!installed[name][version]) {
				const dest = path.join(packagesDir, name, version);
				installed[name][version] = dest;

				await fs.mkdirs(path.dirname(dest));
				logger.log(`Symlinking ${highlight(linkPath)} => ${highlight(path.relative(pluginsDir, dest))}`);
				fs.symlinkSync(linkPath, dest, 'dir');
			}
			newWorkspaces.delete(`packages/${name}/${version}`);
		}
	}

	// loop over default plugins and figure out what is missing
	for (const [ name, specs ] of Object.entries(plugins)) {
		if (installed[name]) {
			for (let i = 0; i < specs.length; i++) {
				for (const ver of Object.keys(installed[name])) {
					if (semver.satisfies(ver, specs[i])) {
						// installed version is good
						specs.splice(i--, 1);
						break;
					}
				}
			}
		}
		for (const spec of specs) {
			install.push(`${name}@${spec}`);
		}
	}

	// install missing plugins
	await Promise.all(install.map(async pkg => {
		let manifest;

		// query npm
		try {
			manifest = await pacote.manifest(pkg, { 'full-metadata': true });
		} catch (e) {
			logger.warn(`Unable to find default plugin on npm: ${highlight(pkg)}`);
			return;
		}

		if (!manifest.appcd) {
			logger.warn(`Package manifest missing "appcd" property: ${highlight(pkg)}`);
			return;
		}

		if (!manifest.appcd.os || manifest.appcd.os.includes(process.platform)) {
			logger.warn(`Package manifest missing "appcd" property: ${highlight(pkg)}`);
			return;
		}

		logger.log(`Downloading ${highlight(`${manifest.name}@${manifest.version}`)}`);
		await pacote.extract(`${manifest.name}@${manifest.version}`, path.join(packagesDir, manifest.name, manifest.version));

		newWorkspaces.add(`packages/${manifest.name}/${manifest.version}`);
	}));

	// if anything was installed or workspaces changed, write the package.json and lerna.json
	// files, then execute lerna
	if (install.length || !eq(existingWorkspaces, newWorkspaces)) {
		const workspaces = Array.from(newWorkspaces);

		// the workspaces changed, so we need to run lerna and since lerna (and yarn) do not like
		// packages with the same name, we need to temporarily change the plugin names
		const revert = {};
		await Promise.all(workspaces.map(async ws => {
			const pkgJsonFile = path.join(pluginsDir, ws, 'package.json');
			const pkgJson = await fs.readJson(pkgJsonFile);
			revert[pkgJson.name] = pkgJsonFile;
			pkgJson.name = `${pkgJson.name}-${pkgJson.version.replace(/[^\w]/g, '_')}`;
			await fs.writeJson(pkgJsonFile, pkgJson);
		}));

		try {
			// write the json files
			logger.log(`Writing ${highlight('plugins/package.json')}`);
			await fs.writeJson(path.join(pluginsDir, 'package.json'), {
				name: 'root',
				private: true,
				version: '0.0.0',
				workspaces
			}, { spaces: 2 });

			logger.log(`Writing ${highlight('plugins/lerna.json')}`);
			await fs.writeJson(path.join(pluginsDir, 'lerna.json'), {
				npmClient: 'yarn',
				npmClientArgs: [
					'--emoji=false',
					'--ignore-engines',
					'--no-lockfile',
					'--no-progress',
					'--production'
				],
				useWorkspaces: true,
				version: 'independent'
			}, { spaces: 2 });

			// run lerna and add yarn to the system path
			const args = [ lerna, 'bootstrap', '--no-progress' ];
			const cmd = process.platform === 'win32' ? args.shift() : process.execPath;
			logger.log(`Executing: ${highlight(`${cmd} ${args.join(' ')}`)}`);
			const child = spawn(cmd, args, {
				cwd: pluginsDir,
				env: {
					...process.env,
					FORCE_COLOR: '0',
					PATH: path.dirname(yarn) + path.delimiter + process.env.PATH
				},
				windowsHide: true
			});

			const newlineRE = /\r\n|\n/;
			const scrubRE = /^lerna (info|notice) /;

			// helper class that pretty formats lerna/yarn output
			class Relay {
				constructor(stream, name, indent) {
					this.buffer = '';
					this.indent = indent ? ' '.repeat(indent) : '';
					this.logger = logger(name);

					stream.on('data', data => {
						const lines = (this.buffer + data.toString()).split(newlineRE);
						this.buffer = lines.pop();
						for (const line of lines) {
							this.logger.log(this.indent + line.replace(scrubRE, ''));
						}
					});
				}

				flush() {
					if (this.buffer) {
						for (const line of this.buffer.split(newlineRE)) {
							this.logger.log(this.indent + line.replace(scrubRE, ''));
						}
					}
				}
			}

			// wire up the relays
			const out = new Relay(child.stdout, 'yarn', 3);
			const err = new Relay(child.stderr, 'lerna');

			await new Promise(resolve => {
				child.on('close', code => {
					out.flush();
					err.flush();

					if (code) {
						logger.warn(`lerna exited with code ${highlight(code)}`);
					}
					resolve();
				});
			});
		} finally {
			// restore the plugin names in the package.json files
			await Promise.all(Object.entries(revert).map(async ([ name, pkgJsonFile ]) => {
				const pkgJson = await fs.readJson(pkgJsonFile);
				pkgJson.name = name;
				await fs.writeJson(pkgJsonFile, pkgJson, { spaces: 2 });
			}));
		}
	}

	logger.log(`Finished in ${highlight(((new Date() - start) / 1000).toFixed(1))} seconds`);
}

/**
 * Compares two sets for equality.
 *
 * @param {Set} s1 - First set.
 * @param {Set} s2 - Second set.
 * @returns {Boolean}
 */
function eq(s1, s2) {
	if (s1.size !== s2.size) {
		return false;
	}
	for (const val of s1) {
		if (!s2.has(val)) {
			return false;
		}
	}
	return true;
}

/**
 * Scans `node_modules/.bin` directories until it locates the requested binary name or hits the
 * root.
 *
 * @param {String} name - The name of the binary to find.
 * @returns {?String} The path to the binary or `null` if not found.
 */
function find(name) {
	for (let bin, cur = __dirname, last = null; cur !== last; last = cur, cur = path.dirname(cur)) {
		if (fs.existsSync(bin = path.join(cur, 'node_modules', '.bin', name + (process.platform === 'win32' ? '.cmd' : '')))) {
			return bin;
		}
	}
	return null;
}
