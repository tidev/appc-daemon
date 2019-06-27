import appcdLogger from 'appcd-logger';
import fs from 'fs-extra';
import globule from 'globule';
import os from 'os';
import pacote from 'pacote';
import path from 'path';
import semver from 'semver';

import { spawn } from 'child_process';

const logger = appcdLogger('appcd:default-plugins');
const { highlight } = appcdLogger.styles;

/**
 * ?
 *
 * @param {String} pluginsDir - Path to the plugins directory.
 * @returns {Promise}
 */
export default async function installDefaultPlugins(pluginsDir) {
	const start = new Date();

	if (!pluginsDir || typeof pluginsDir !== 'string') {
		throw new TypeError('Expected plugins directory to be a non-empty string');
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

	const packagesDir = path.join(pluginsDir, 'packages');
	const invalidDir = path.join(pluginsDir, 'invalid');
	const linksDir = path.join(os.homedir(), '.config', 'yarn', 'link');
	const workspaces = [];
	const { plugins } = fs.readJsonSync(path.resolve(__dirname, '..', 'package.json'));
	const installed = {};

	// make sure the plugins/packages directory exists
	fs.mkdirsSync(packagesDir);

	// determine what packages are already installed
	for (const rel of globule.find('*/*/package.json', '@*/*/*/package.json', { srcBase: packagesDir })) {
		const pkgJsonFile = path.join(packagesDir, rel);
		const src = path.dirname(pkgJsonFile);
		const { name, version } = fs.readJsonSync(pkgJsonFile);

		const nameDir = path.dirname(path.dirname(rel));
		const versionDir = path.basename(src);

		if (name !== nameDir) {
			if (fs.lstatSync(src).isSymbolicLink()) {
				logger.warn(`Plugin directory name mismatch: ${highlight(`${name}@${version}`)} found in ${highlight(nameDir)}, unlinking...`);
				fs.unlinkSync(src);
			} else {
				logger.warn(`Plugin directory name mismatch: ${highlight(`${name}@${version}`)} found in ${highlight(nameDir)}, invalidating...`);
				fs.moveSync(src, path.join(invalidDir, path.dirname(rel)), { overwrite: true });
			}
			continue;
		}

		if (version !== versionDir) {
			logger.warn(`Plugin directory version mismatch: ${highlight(`${name}@${version}`)} found in ${highlight(versionDir)}, invalidating...`);
			fs.moveSync(src, path.join(invalidDir, path.dirname(rel)), { overwrite: true });
			continue;
		}

		if (installed[name]) {
			installed[name].push(version);
		} else {
			installed[name] = [ version ];
		}
	}

	// a function that installs/link a single plugin/version
	const processPlugin = async (name, spec) => {
		let link;
		let manifest;

		// check for a local yarn link first
		try {
			const dir = path.join(linksDir, name);
			const { name, version } = await fs.readJson(dir, 'package.json');
			if (semver.satisfies(version, spec)) {
				link = { name, version, path: dir };
			}
		} catch (e) {
			// link does not exist, oh well
		}

		// query npm
		try {
			manifest = await pacote.manifest(`${name}@${spec}`);
		} catch (e) {
			logger.warn(`Unable to find default plugin on npm: ${highlight(`${name}@${spec}`)}`);
		}

		// either download from npm or symlink
		if (manifest && (!link || semver.gt(manifest.version, link.version))) {
			if (installed[name] && installed[name].includes(manifest.version)) {
				logger.log(`Default plugin already installed: ${highlight(`${manifest.name}@${manifest.version}`)}`);
			} else {
				logger.log(`Downloading ${highlight(`${manifest.name}@${manifest.version}`)}`);
				await pacote.extract(`${manifest.name}@${manifest.version}`, path.join(packagesDir, manifest.name, manifest.version));
			}
			workspaces.push(`packages/${manifest.name}/${manifest.version}`);
		} else if (link) {
			if (installed[name] && installed[name].includes(link.version)) {
				logger.log(`Default plugin already linked: ${highlight(`${link.name}@${link.version}`)}`);
			} else {
				const dest = path.join(packagesDir, link.name, link.version);
				logger.log(`Symlinking ${highlight(link.path)} => ${highlight(path.relative(pluginsDir, dest))}`);
				fs.symlinkSync(link.path, dest, 'dir');
			}
			workspaces.push(`packages/${link.name}/${link.version}`);
		} else {
			logger.error(`Failed to install default plugin: ${highlight(`${name}@${spec}`)}`);
		}
	};

	// build the list of process plugin promises
	const pluginsList = [];
	for (const [ name, versions ] of Object.entries(plugins)) {
		for (const spec of versions) {
			pluginsList.push(processPlugin(name, spec));
		}
	}

	// loop over each required plugin and install/link them
	await Promise.all(pluginsList);

	// write the json files
	logger.log(`Writing ${highlight('plugins/package.json')}`);
	fs.writeFileSync(path.join(pluginsDir, 'package.json'), JSON.stringify({
		name: 'root',
		private: true,
		version: '0.0.0',
		workspaces
	}, null, 2));

	logger.log(`Writing ${highlight('plugins/lerna.json')}`);
	fs.writeFileSync(path.join(pluginsDir, 'lerna.json'), JSON.stringify({
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
	}, null, 2));

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

	logger.log(`Finished in ${highlight(((new Date() - start) / 1000).toFixed(1))} seconds`);
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
		if (fs.existsSync(bin = path.join(cur, 'node_modules', '.bin', name))) {
			return bin;
		}
	}
	return null;
}
