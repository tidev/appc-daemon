import appcdLogger from 'appcd-logger';
import binLinks from 'bin-links';
import fs from 'fs-extra';
import globalModules from 'global-modules';
import globule from 'globule';
import HookEmitter from 'hook-emitter';
import npmsearch from 'libnpmsearch';
import os from 'os';
import pacote from 'pacote';
import path from 'path';
import promiseLimit from 'promise-limit';
import semver from 'semver';

import { appcdPluginAPIVersion, detectScheme } from 'appcd-plugin';
import { expandPath } from 'appcd-path';
import { isFile } from 'appcd-fs';
import { loadConfig } from './config';
import { spawn } from 'child_process';

const logger = appcdLogger('appcd:plugins');
const { highlight } = appcdLogger.styles;

export const defaultPlugins = fs.readJSONSync(path.resolve(__dirname, '..', 'default-plugins.json'));

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
 * @returns {Promise<?String>} The path to the binary or `null` if not found.
 */
async function find(name) {
	for (let bin, cur = __dirname, last = null; cur !== last; last = cur, cur = path.dirname(cur)) {
		bin = path.join(cur, 'node_modules', '.bin', name + (process.platform === 'win32' ? '.cmd' : ''));
		if (isFile(bin)) {
			return bin;
		}

		// find the package and create the bin link
		const dir = path.join(cur, 'node_modules', name);
		const pkgJsonFile = path.join(dir, 'package.json');
		if (isFile(pkgJsonFile)) {
			logger.log(`Unable to find ${name} binary, generating new binary for ${highlight(dir)}`);
			await binLinks({
				path: dir,
				pkg: await fs.readJson(pkgJsonFile)
			});

			if (isFile(bin)) {
				return bin;
			}
		}
	}
	return null;
}

async function checkVersion(manifest) {
	if (!manifest.appcd) {
		throw new Error(`${manifest.name}@${manifest.version} is not an appcd plugin`);
	}

	manifest.issues = {};

	// old plugins didn't have an api version, so default it to 1.x
	if (!manifest.appcd.apiVersion) {
		manifest.appcd.apiVersion = '1.x';
	}

	if (manifest.appcd.os && !manifest.appcd.os.includes(process.platform)) {
		manifest.issues.platform = `Plugin ${manifest.name}@${manifest.version} is not compatible with the current platform`;
	}

	if (manifest.appcd.apiVersion && !semver.satisfies(appcdPluginAPIVersion, manifest.appcd.apiVersion)) {
		manifest.issues.apiVersion = `${manifest.name}@${manifest.version} is not compatible with plugin API version ${appcdPluginAPIVersion}`;
	}

	const { version } = await fs.readJson(path.resolve(__dirname, '..', 'package.json'));
	if (manifest.appcd.appcdVersion && !semver.satisfies(version, manifest.appcd.appcdVersion)) {
		manifest.issues.appcdVersoin = `${manifest.name}@${manifest.version} is not compatible with Appcd Core version ${version}`;
	}

	manifest.supported = Object.keys(manifest.issues).length === 0;
}

async function getPluginInfo(pkg) {
	let info;

	try {
		info = await pacote.packument(pkg, { fullMetadata: true });
	} catch (e) {
		if (e.code === 'E404') {
			const e2 = new Error(`Plugin ${pkg} not found`);
			e2.code = 'ENOTFOUND';
			throw e2;
		}
		throw e;
	}

	for (const [ ver, manifest ] of Object.entries(info.versions)) {
		try {
			await checkVersion(manifest);
		} catch (e) {
			delete info.versions[ver];
			if (!Object.keys(info.versions).length) {
				throw e;
			}
		}
	}

	return info;
}

async function getPluginManifest(pkg) {
	let manifest;

	try {
		manifest = await pacote.manifest(pkg, { fullMetadata: true });
	} catch (e) {
		if (e.code === 'E404') {
			const e2 = new Error(`Plugin ${pkg} not found`);
			e2.code = 'ENOTFOUND';
			throw e2;
		}
		throw e;
	}

	await checkVersion(manifest);

	return manifest;
}

export function getPluginPaths(home) {
	if (!home) {
		home = loadConfig().get('home');
	}

	return [
		expandPath(home, 'plugins', 'packages'), // appcd home plugins
		globalModules // global npm directory
	];
}

export function install(pluginName, home) {
	const emitter = new HookEmitter();

	setImmediate(async () => {
		try {
			if (!home) {
				home = loadConfig().get('home');
			} else if (typeof home !== 'string') {
				throw new TypeError('Expected home directory to be a non-empty string');
			}

			if (!pluginName || typeof pluginName !== 'string') {
				throw new TypeError('Expected plugin name to install or "default"');
			}

			const pluginsDir = expandPath(home, 'plugins');
			const packagesDir = path.join(pluginsDir, 'packages');
			const yarnDir = process.platform === 'win32'
				? path.join(os.homedir(), 'AppData', 'Local', 'Yarn')
				: path.join(os.homedir(), '.config', 'yarn');

			// check that we can write to the plugins dir
			try {
				// make sure the plugins/packages directory exists
				await fs.mkdirs(packagesDir);
				await fs.access(packagesDir);
			} catch (e) {
				const err = new Error(e.code === 'EACCES'
					? `Cannot write to plugins directory: ${packagesDir}`
					: `Error initializing plugins directory: ${e.message}`);
				err.code = e.code;
				throw err;
			}

			// check yarn config directory permissions
			try {
				await fs.access(yarnDir);
			} catch (e) {
				if (e.code === 'EACCES') {
					const err = new Error(`Cannot write to Yarn config directory: ${yarnDir}`);
					err.code = e.code;
					throw err;
				}
			}

			// find yarn and lerna
			const yarn = await find('yarn');
			if (yarn) {
				logger.log(`Found yarn: ${highlight(yarn)}`);
			} else {
				throw new Error('Unable to find yarn bin, skipping install default plugins');
			}

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
			const installed = {};
			const newWorkspaces = new Set();

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

			// build a list of manifests for each package to be installed
			const toInstall = [];
			const addToInstall = manifest => {
				if (manifest.appcd.os && !manifest.appcd.os.includes(process.platform)) {
					const err = new Error(`Plugin ${manifest.name}@${manifest.version} is not compatible with the current platform`);
					err.code = 'EINCOMPATIBLE';
					throw err;
				}

				if (installed[manifest.name]?.[manifest.version]) {
					throw new Error(`Plugin ${manifest.name}@${manifest.version} is already installed`);
				}

				toInstall.push(manifest);
			};

			if (pluginName === 'default') {
				for (const [ name, specs ] of Object.entries(defaultPlugins)) {
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
						try {
							addToInstall(await getPluginManifest(`${name}@${spec}`));
						} catch (e) {
							// skip incompatible plugins
						}
					}
				}
			} else {
				addToInstall(await getPluginManifest(pluginName));
			}

			await emitter.emit('pre-install', toInstall);

			for (const manifest of toInstall) {
				const dest = path.join(packagesDir, manifest.name, manifest.version);
				if (fs.existsSync(dest)) {
					logger.log(`Removing destination: ${highlight(dest)}`);
					await fs.remove(dest);
				}

				logger.log(`Downloading ${highlight(`${manifest.name}@${manifest.version}`)}`);
				await emitter.emit('download', manifest);
				await pacote.extract(`${manifest.name}@${manifest.version}`, dest);

				newWorkspaces.add(`packages/${manifest.name}/${manifest.version}`);
			}

			// if anything was installed or workspaces changed, write the package.json, then
			// execute yarn
			if (toInstall.length || !eq(existingWorkspaces, newWorkspaces)) {
				const workspaces = Array.from(newWorkspaces);

				// the workspaces changed, so we need to run yarn and since yarn does not like
				// packages with the same name, we need to temporarily change the plugin names
				const revert = {};
				await Promise.all(workspaces.map(async ws => {
					const pkgJsonFile = path.join(pluginsDir, ws, 'package.json');
					const pkgJson = await fs.readJson(pkgJsonFile);
					const newName = `${pkgJson.name}-${pkgJson.version.replace(/[^\w]/g, '_')}`;
					revert[newName] = { name: pkgJson.name, pkgJsonFile };
					logger.log(`Renaming package name ${highlight(pkgJson.name)} => ${highlight(newName)}`);
					pkgJson.name = newName;
					await fs.writeJson(pkgJsonFile, pkgJson);
				}));

				// lerna spawns yarn using `execa()` which implicitly overrides the inherited path, so we
				// have to manually set the environment variables, which for some reason works whereas
				// setting the `env` in `spawn()` does not.
				const origPath = process.env.PATH;
				const origForceColor = process.env.FORCE_COLOR;
				if (yarn) {
					process.env.PATH = `${path.dirname(yarn)}${path.delimiter}${origPath}`;
				}
				process.env.FORCE_COLOR = '0';

				try {
					// write the json files
					logger.log(`Writing ${highlight('plugins/package.json')}`);
					await fs.writeJson(path.join(pluginsDir, 'package.json'), {
						name: 'root',
						private: true,
						version: '0.0.0',
						workspaces
					}, { spaces: 2 });

					await emitter.emit('install');

					// run yarn
					await new Promise(resolve => {
						const args = [ yarn, '--no-progress', '--production' ];
						const cmd = process.platform === 'win32' ? args.shift() : process.execPath;
						logger.log(`Plugins dir: ${highlight(pluginsDir)}`);
						logger.log(`Executing: ${highlight(`${cmd} ${args.join(' ')}`)}`);

						const child = spawn(cmd, args, {
							cwd: pluginsDir,
							windowsHide: true
						});

						const print = data => data.toString().split(/\r\n|\n/).forEach(line => logger.log(line));
						child.stdout.on('data', print);
						child.stderr.on('data', print);
						child.on('close', code => {
							logger.warn(`lerna exited with code ${highlight(code)}`);
							resolve();
						});
					});
				} finally {
					process.env.PATH = origPath;
					process.env.FORCE_COLOR = origForceColor;

					// restore the plugin names in the package.json files
					await Promise.all(Object.values(revert).map(async ({ name, pkgJsonFile }) => {
						const pkgJson = await fs.readJson(pkgJsonFile);
						logger.log(`Restoring package name ${highlight(pkgJson.name)} => ${highlight(name)}`);
						pkgJson.name = name;
						await fs.writeJson(pkgJsonFile, pkgJson, { spaces: 2 });
					}));
				}
			}

			await emitter.emit('finish');
		} catch (err) {
			await emitter.emit('error', err);
		}
	});

	return emitter;
}

export async function list(home, filter, searchPaths) {
	if (!searchPaths) {
		searchPaths = getPluginPaths(home);
	} else if (!Array.isArray(searchPaths)) {
		throw new TypeError('Expected search paths to be an array');
	}

	const plugins = [];
	for (const pluginPath of searchPaths) {
		const SchemeClass = detectScheme(pluginPath);
		const scheme = new SchemeClass(pluginPath);
		plugins.push.apply(plugins, await scheme.detect());
	}

	return plugins
		.filter(plugin => !filter || plugin.packageName.toLowerCase().includes(filter))
		.map(plugin => ({
			name:         plugin.packageName,
			version:      plugin.version,
			description:  plugin.description,
			homepage:     plugin.homepage,
			license:      plugin.license,
			endpoint:     `/${plugin.name}/${plugin.version}`,
			path:         plugin.path,
			type:         plugin.type,
			error:        plugin.error,
			supported:    plugin.supported,
			os:           plugin.os,
			apiVersion:   plugin.apiVersion,
			appcdVersion: plugin.appcdVersion
		}));
}

export async function search(criteria) {
	criteria = (Array.isArray(criteria) ? criteria : [ criteria ]).filter(Boolean);
	const keywords = new Set([ 'appcd', 'appcd-plugin', ...criteria ]);
	const limit = promiseLimit(10);
	const packages = await npmsearch(Array.from(keywords));
	const results = [];

	await Promise.all(packages.map(pkg => limit(async () => {
		try {
			results.push(await getPluginInfo(pkg.name));
		} catch (e) {
			// silence
		}
	})));

	return results;
}

export async function uninstall(pkg) {
	// delete the package
	// rename all other package names
	// remove the links under node_modules
	// remove from package.json workspaces
	// run yarn
}

export async function update(pkg) {
	// get list of installed plugins
	// check for newer versions
	// download and install updates
}

export async function view(pkg) {
	if (!pkg || typeof pkg !== 'string') {
		throw new TypeError('Invalid package name');
	}
	return await getPluginInfo(pkg);
}
