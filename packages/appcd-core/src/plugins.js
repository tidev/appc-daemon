import appcdLogger from 'appcd-logger';
import binLinks from 'bin-links';
import fs from 'fs-extra';
import globalModules from 'global-modules';
import globule from 'globule';
import HookEmitter from 'hook-emitter';
import npa from 'npm-package-arg';
import npmsearch from 'libnpmsearch';
import os from 'os';
import pacote from 'pacote';
import path from 'path';
import promiseLimit from 'promise-limit';
import semver from 'semver';
import TemplateEngine from 'template-kit';
import validate from 'validate-npm-package-name';

import { appcdPluginAPIVersion, detectScheme } from 'appcd-plugin';
import { expandPath } from 'appcd-path';
import { isDir, isFile } from 'appcd-fs';
import { loadConfig } from './config';
import { spawnNode } from 'appcd-nodejs';
import { tailgate, unique } from 'appcd-util';

const logger = appcdLogger('appcd:plugins');
const { highlight } = appcdLogger.styles;

/**
 * The parsed contents of the Appc Daemon core `package.json`.
 * @type {Object}
 */
const appcdCorePkgJson = fs.readJsonSync(path.resolve(__dirname, '..', 'package.json'));

/**
 * The Appc Daemon core version.
 * @type {String}
 */
const appcdCoreVersion = appcdCorePkgJson.version;

/**
 * The Node.js version required to run the Appc Daemon core.
 * @type {String}
 */
const appcdCoreNodejs = appcdCorePkgJson.appcd.node;

/**
 * Checks if there are updated releases for installed plugins as well as any new releases that are
 * installed.
 *
 * @param {Object} params - Various parameters.
 * @param {String} params.home - The path to the appcd home directory.
 * @param {Array.<String>} [params.plugins] - One or more plugins to check or blank for all.
 * @returns {Promise<Array.<Object>>} Resolves an array of plugins with updates available.
 */
export async function checkUpdates({ home, plugins }) {
	const results = [];
	const pluginsDir = expandPath(home, 'plugins');
	let pluginMap;
	const { installed } = await detectInstalled(pluginsDir);
	const limit = promiseLimit(10);

	if (plugins) {
		if (!Array.isArray(plugins) || plugins.some(p => !p || typeof p !== 'string')) {
			throw new TypeError('Expected plugins to be an array of plugin names');
		}

		if (plugins.length) {
			pluginMap = {};
			for (const plugin of unique(plugins)) {
				const { name, fetchSpec } = npa(plugin);
				pluginMap[name] = fetchSpec;
			}
		}
	}

	await Promise.all(Object.entries(installed).map(([ name, versions ]) => {
		return limit(async () => {
			if (!pluginMap || pluginMap[name]) {
				const packument = await getPluginPackument(name);
				const latestAvailable = packument['dist-tags'].latest || Object.keys(packument.versions).sort(semver.rcompare)[0];
				const vers = Object.keys(versions).sort(semver.rcompare);

				const installedMajors = getMajors(vers);
				const availableMajors = getMajors(Object.keys(packument.versions));

				// check each major for any updates
				for (const major of Object.keys(installedMajors)) {
					if (availableMajors[major] && semver.gt(availableMajors[major], installedMajors[major])) {
						results.push({ name, installed: installedMajors[major], available: availableMajors[major] });
					}
				}

				// check if there's a new major that we don't have
				if (!installedMajors[semver.major(latestAvailable)]) {
					results.push({ name, installed: null, available: latestAvailable });
				}
			}
		});
	}));

	return results;
}

/**
 * Creates a new plugin project.
 *
 * @param {Object} params - Various parameters.
 * @param {String} params.dest - The directory to create the plugin project in.
 * @param {String} params.name - The name of the plugin.
 * @param {String} [params.template] - A path or URL to the template to use. Defaults to the
 * built-in plugin template.
 * @returns {HookEmitter}
 */
export function create({ dest, name, template }) {
	const emitter = new HookEmitter();

	setImmediate(async () => {
		try {
			if (!dest || typeof dest !== 'string') {
				throw new TypeError('Expected destination to be a non-empty string');
			}

			if (!name || typeof name !== 'string') {
				throw new TypeError('Expected cwd to be a non-empty string');
			}

			if (!validate(name).validForNewPackages) {
				throw new Error(`Template name "${name}" is not a valid package name`);
			}

			// note that we can't simply use require.resolve() since templates may not have a
			// "main" or index.js file, so we must look for it manually
			const rel = 'node_modules/@appcd/template-plugin';
			let dir = path.dirname(__dirname);
			while (!template) {
				let tmp = path.join(dir, rel);
				if (fs.existsSync(tmp)) {
					template = tmp;
					break;
				}
				tmp = path.dirname(dir);
				if (tmp === dir) {
					throw new Error('Cannot find @appcd/template-plugin!');
				}
				dir = tmp;
			}

			const serviceName = name.replace(/^appcd-plugin-/, '');
			const engine = new TemplateEngine()
				.on('download',     () => emitter.emit('status', 'Downloading from URL...'))
				.on('npm-download', () => emitter.emit('status', 'Downloading from npm...'))
				.on('extract',      () => emitter.emit('status', 'Extracting archive...'))
				.on('copy',         () => emitter.emit('status', 'Copying files...'))
				.on('npm-install',  () => emitter.emit('status', 'Installing dependencies...'))
				.on('git-init',     () => emitter.emit('status', 'Initializing repo...'))
				.on('cleanup',      () => emitter.emit('status', 'Cleaning up...'));

			await engine.run({
				data: {
					packageName: name,
					serviceName
				},
				dest,
				src: template
			});

			await emitter.emit('finish', { dest, pluginName: name, serviceName });
		} catch (err) {
			await emitter.emit('error', err);
		}
	});

	return emitter;
}

/**
 * Scans the appcd home plugin directory for existing plugins. This uses a lazy scanning method
 * instead of the more involved scheme detection system in appcd-plugin because we know it's always
 * going to be a nested plugin directory scheme.
 *
 * @param {String} pluginsDir - The path to the appcd home plugins directory.
 * @returns {Promise<Object>}
 */
async function detectInstalled(pluginsDir) {
	const installed = {};
	const packagesDir = path.join(pluginsDir, 'packages');
	const workspaces = new Set();

	// as we scan, we clean up anything that doesn't look good
	const cleanup = (src, invalidDest, msg) => {
		if (fs.lstatSync(src).isSymbolicLink()) {
			logger.warn(`${msg}, unlinking...`);
			fs.unlinkSync(src);
		} else {
			logger.warn(`${msg}, invalidating...`);
			fs.moveSync(src, invalidDest, { overwrite: true });
		}
	};

	const scanVersion = (dir, crumbs, results) => {
		for (const ver of fs.readdirSync(dir)) {
			const subdir = path.join(dir, ver);
			if (!fs.existsSync(subdir) && fs.lstatSync(subdir).isSymbolicLink()) {
				pruneDir(subdir, packagesDir);
			} else if (fs.existsSync(path.join(subdir, 'package.json'))) {
				results.push(`${crumbs.join('/')}/${ver}/package.json`);
			}
		}
	};

	const scan = (dir, crumbs = [], results = []) => {
		try {
			for (const scopeOrPackageName of fs.readdirSync(dir)) {
				crumbs.push(scopeOrPackageName);
				try {
					const subdir = path.join(dir, scopeOrPackageName);
					if (scopeOrPackageName[0] === '@') {
						scan(subdir, crumbs, results);
					} else {
						scanVersion(subdir, crumbs, results);
					}
				} catch (e) {
					// squelch
				}
				crumbs.pop();
			}
		} catch (e) {
			// squelch
		}
		return results;
	};

	// determine what packages are already installed
	for (const rel of scan(packagesDir)) {
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
			workspaces.add(`packages/${name}/${version}`);
		}
	}

	return { installed, workspaces };
}

/**
 * Scans `node_modules/.bin` directories until it locates `yarn`.
 *
 * @returns {Promise<String>} The path to the yarn binary.
 */
async function findYarn() {
	let yarn;

	for (let cur = __dirname, last = null; cur !== last; last = cur, cur = path.dirname(cur)) {
		yarn = path.join(cur, 'node_modules', '.bin', `yarn${process.platform === 'win32' ? '.cmd' : ''}`);
		if (isFile(yarn)) {
			break;
		}

		// find the package and create the bin link
		const dir = path.join(cur, 'node_modules', 'yarn');
		const pkgJsonFile = path.join(dir, 'package.json');
		if (isFile(pkgJsonFile)) {
			logger.log(`Unable to find the Yarn binary, generating new binary for ${highlight(dir)}`);
			await binLinks({
				path: dir,
				pkg: await fs.readJson(pkgJsonFile)
			});

			if (isFile(yarn)) {
				break;
			}
		}
	}

	if (!yarn) {
		throw new Error('Unable to find yarn bin, skipping install default plugins');
	}

	logger.log(`Found yarn: ${highlight(yarn)}`);

	// check yarn config directory permissions
	const yarnDir = process.platform === 'win32'
		? path.join(os.homedir(), 'AppData', 'Local', 'Yarn')
		: path.join(os.homedir(), '.config', 'yarn');
	if (isDir(yarnDir)) {
		try {
			await fs.access(yarnDir);
		} catch (e) {
			throw new Error(`Cannot write to Yarn config directory: ${yarnDir}`);
		}
	}

	return yarn;
}

/**
 * Analyzes a list of versions and determines the latest one per major version.
 *
 * @param {Array.<String>} versions - A list of package versions to extract the majors from.
 * @returns {Object}
 */
export function getMajors(versions) {
	const majors = {};

	for (const ver of versions) {
		const major = semver.major(ver);
		if (majors[major] === undefined || semver.gt(ver, majors[major])) {
			majors[major] = ver;
		}
	}

	return majors;
}

/**
 * Retrieves the packument from npm for the specified package. The packument contains manifests for
 * all versions of a package. If all versions are detected as invalid appcd plugins, then an error
 * is thrown.
 *
 * @param {String} pkg - The name of the package.
 * @returns {Promise<Object>}
 */
async function getPluginPackument(pkg) {
	let info;

	try {
		info = await pacote.packument(pkg, { fullMetadata: true });
		const vers = Object.keys(info.versions).sort(semver.rcompare);
		const { fetchSpec } = npa(pkg);
		info.version = (fetchSpec && info['dist-tags']?.[fetchSpec]) || (fetchSpec && info.versions[fetchSpec] && fetchSpec) || info['dist-tags']?.latest || vers[0];
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
			await validateManifest(manifest);
		} catch (e) {
			delete info.versions[ver];
			if (!Object.keys(info.versions).length) {
				throw e;
			}
		}
	}

	return info;
}

/**
 * Retrieves the manifest from npm for the specified package. If package is not a valid appcd
 * plugin, then an error is thrown.
 *
 * @param {String} pkg - The name of the package.
 * @returns {Promise<Object>}
 */
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

	return await validateManifest(manifest);
}

/**
 * Returns a list of all paths to search for appcd plugins.
 *
 * @param {String} [home] - The path to the appcd home directory.
 * @returns {Array.<String>}
 */
export function getPluginPaths(home) {
	if (!home) {
		home = loadConfig().get('home');
	}

	return [
		expandPath(home, 'plugins', 'packages'), // appcd home plugins
		globalModules // global npm directory
	];
}

/**
 * Installs a plugin from npm.
 *
 * @param {Object} params - Various parameters.
 * @param {String} params.home - The path to the appcd home directory.
 * @param {Array.<String>} params.plugins - One or more plugins to install.
 * @returns {HookEmitter}
 */
export function install({ home, plugins }) {
	const emitter = new HookEmitter();

	setImmediate(async () => {
		try {
			if (!home) {
				home = loadConfig().get('home');
			} else if (typeof home !== 'string') {
				throw new TypeError('Expected home directory to be a non-empty string');
			}

			if (!Array.isArray(plugins) || plugins.some(p => !p || typeof p !== 'string')) {
				throw new TypeError('Expected plugins to be an array of plugin names');
			}

			const pluginsDir = expandPath(home, 'plugins');
			const packagesDir = path.join(pluginsDir, 'packages');
			const yarn = await findYarn();

			// check that we can write to the plugins dir
			try {
				// make sure the plugins/packages directory exists and writable
				await fs.mkdirs(packagesDir);
				await fs.access(packagesDir);
			} catch (e) {
				const err = new Error(e.code === 'EACCES'
					? `Cannot write to plugins directory: ${packagesDir}`
					: `Error initializing plugins directory: ${e.message}`);
				err.code = e.code;
				throw err;
			}

			let { installed, workspaces: newWorkspaces } = await detectInstalled(pluginsDir);

			// build a list of manifests for each package to be installed
			let toInstall = {};
			const addToInstall = manifest => {
				if (manifest.appcd.os && !manifest.appcd.os.includes(process.platform)) {
					throw new Error(`Plugin ${manifest.name}@${manifest.version} is not compatible with the current platform`);
				}

				if (installed[manifest.name]?.[manifest.version]) {
					throw new Error(`Plugin ${manifest.name}@${manifest.version} is already installed`);
				}

				const key = `${manifest.name}@${manifest.version}`;
				if (!toInstall[key]) {
					toInstall[key] = manifest;
				}
			};

			const limit = promiseLimit(10);

			for (const plugin of unique(plugins)) {
				if (plugin === 'default') {
					const { defaultPlugins } = (await fs.readJSON(path.resolve(__dirname, '..', 'package.json'))).appcd;
					await Promise.all(defaultPlugins.map(plugin => limit(async () => {
						try {
							const packument = await getPluginPackument(plugin);
							const availableMajors = getMajors(Object.keys(packument.versions));
							for (const ver of Object.values(availableMajors)) {
								try {
									addToInstall(packument.versions[ver]);
								} catch (e) {
									// silence
								}
							}
						} catch (e) {
							// silence
						}
					})));
				} else {
					addToInstall(await getPluginManifest(plugin));
				}
			}

			toInstall = Object.values(toInstall);
			await emitter.emit('pre-install', toInstall);

			for (const manifest of toInstall) {
				manifest.path = path.join(packagesDir, manifest.name, manifest.version);
				if (fs.existsSync(manifest.path)) {
					logger.log(`Removing destination: ${highlight(manifest.path)}`);
					await fs.remove(manifest.path);
				}

				logger.log(`Downloading ${highlight(`${manifest.name}@${manifest.version}`)}`);
				await emitter.emit('download', manifest);
				await pacote.extract(`${manifest.name}@${manifest.version}`, manifest.path);

				newWorkspaces.add(`packages/${manifest.name}/${manifest.version}`);
			}

			const existingWorkspaces = await loadWorkspaces(pluginsDir);
			newWorkspaces = Array.from(newWorkspaces).sort();

			// if anything was installed or workspaces changed, write the package.json, then
			// execute yarn
			if (toInstall.length || existingWorkspaces < newWorkspaces || existingWorkspaces > newWorkspaces) {
				await updateMonorepo({
					fn: () => emitter.emit('install'),
					home,
					workspaces: newWorkspaces,
					yarn
				});
			}

			await emitter.emit('finish', toInstall);
		} catch (err) {
			await emitter.emit('error', err);
		}
	});

	return emitter;
}

/**
 * Detects all Yarn linked appcd plugins and symlinks to them in the appcd home plugin directory.
 *
 * @param {String} home - The path to the appcd home directory.
 * @returns {Promise<Array.<String>>}
 */
export async function link(home) {
	const plugins = [];
	const pluginsDir = expandPath(home, 'plugins');
	const packagesDir = path.join(pluginsDir, 'packages');
	const yarn = await findYarn();
	const linksDir = process.platform === 'win32'
		? path.join(os.homedir(), 'AppData', 'Local', 'Yarn', 'Data', 'link')
		: path.join(os.homedir(), '.config', 'yarn', 'link');

	// this is just to clean up anything out of whack
	await detectInstalled(pluginsDir);

	try {
		const pkgJsons = globule.find('*/package.json', '@*/*/package.json', { srcBase: linksDir });
		logger.log('Found linked packages:');
		logger.log(pkgJsons);

		for (const rel of pkgJsons) {
			const pkgJsonFile = path.join(linksDir, rel);
			const linkPath = path.dirname(pkgJsonFile);
			let appcd, name, version;

			try {
				({ appcd, name, version } = await fs.readJson(pkgJsonFile));
			} catch (e) {
				logger.warn(`Failed to parse link package.json: ${pkgJsonFile}`);
				continue;
			}

			if (!appcd || !name || !version || (appcd.os && !appcd.os.includes(process.platform))) {
				logger.warn(`Skipping non-appcd package: ${pkgJsonFile}`);
				continue;
			}

			const dest = path.join(packagesDir, name, version);
			await fs.remove(dest);
			await fs.mkdirs(path.dirname(dest));

			logger.log(`Symlinking ${highlight(linkPath)} => ${highlight(path.relative(pluginsDir, dest))}`);
			fs.symlinkSync(linkPath, dest, 'dir');

			plugins.push({ name, version, appcd, link: linkPath, path: dest });
		}
	} catch (e) {
		logger.warn('The yarn links directory exists, but access is denied');
	}

	await updateMonorepo({
		home,
		yarn
	});

	return plugins;
}

/**
 * Detects all installed plugins, both global and in the appcd home plugins directory.
 *
 * @param {Object} params - Various parameters.
 * @param {String} [params.filter] - A plugin name to filter for.
 * @param {String} params.home - The path to the appcd home directory.
 * @param {Array.<String>} [params.searchPaths] - A list of paths to search for plugins.
 * @returns {Promise<Array.<Object>>} Resolves a list of all installed plugins.
 */
export async function list({ filter, home, searchPaths }) {
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
			appcdVersion: plugin.appcdVersion,
			link:         plugin.link
		}));
}

/**
 * Loads the monorepo orchestrating `package.json` and returns a unique list of the declared
 * workspaces.
 *
 * @param {String} pluginsDir - The path to the appcd home plugins directory.
 * @returns {Promise<Array.<String>>}
 */
async function loadWorkspaces(pluginsDir) {
	try {
		return Array.from(new Set((await fs.readJson(path.join(pluginsDir, 'package.json'))).workspaces)).sort();
	} catch (e) {
		return [];
	}
}

/**
 * Removes a directory and all empty parent directories up to the specified plugins directory.
 *
 * @param {String} dir - The directory under the appcd home plugins directory to delete.
 * @param {String} pluginsDir - The path to the appcd home plugins directory.
 * @returns {Promise}
 */
async function pruneDir(dir, pluginsDir) {
	logger.log(`Deleting ${highlight(dir)}`);
	await fs.remove(dir);

	dir = path.dirname(dir);

	// since this function can be called async, we want to avoid a race condition and only allow
	// one of the prune operations to clean up the parent directories
	await tailgate(`plugins_${dir}`, async () => {
		while (dir !== pluginsDir) {
			await fs.remove(path.join(dir, '.DS_Store'));
			if (fs.readdirSync(dir).length) {
				break;
			}
			logger.log(`Deleting ${highlight(dir)}`);
			await fs.remove(dir);
			dir = path.dirname(dir);
		}
	});
}

/**
 * Searches npm for appcd plugins matching the specified criteria.
 *
 * @param {String|Array.<String>} criteria - A keyword or list of keywords to search for.
 * @returns {Promse<Array.<Object>>} Resolves a list of plugin manifest objects.
 */
export async function search(criteria) {
	criteria = (Array.isArray(criteria) ? criteria : [ criteria ]).filter(Boolean);
	const keywords = new Set([ 'appcd', 'appcd-plugin', ...criteria ]);
	const limit = promiseLimit(10);
	const packages = await npmsearch(Array.from(keywords));
	const results = [];

	await Promise.all(packages.map(pkg => limit(async () => {
		try {
			results.push(await getPluginPackument(pkg.name));
		} catch (e) {
			// silence
		}
	})));

	return results;
}

/**
 *
 * @param {Object} params - Various parameters.
 * @param {Function} [params.fn] - A callback to fire after setup and before calling Yarn.
 * @param {String} params.home - The path to the appcd home directory.
 * @param {Array.<String>} params.workspaces - A list of plugin version directory paths relative
 * to the plugins directory.
 * @param {String} params.yarn - The path the Yarn binary.
 * @returns {Promise}
 */
async function updateMonorepo({ fn, home, workspaces, yarn }) {
	const pluginsDir = expandPath(home, 'plugins');

	logger.log('Updating monorepo');

	if (!workspaces) {
		workspaces = await loadWorkspaces(pluginsDir);
	}

	// remove any workspaces that are links
	workspaces = workspaces.filter(ws => !fs.lstatSync(path.join(pluginsDir, ws)).isSymbolicLink());

	// update the package.json workspaces
	logger.log(`Writing ${highlight('plugins/package.json')}`);
	await fs.outputJson(path.join(pluginsDir, 'package.json'), {
		name: 'root',
		private: true,
		version: '0.0.0',
		workspaces,
		appcd: {
			node: appcdCoreNodejs
		}
	}, { spaces: 2 });

	const origPath = process.env.PATH;
	const origForceColor = process.env.FORCE_COLOR;
	if (yarn) {
		process.env.PATH = `${path.dirname(yarn)}${path.delimiter}${origPath}`;
	}
	process.env.FORCE_COLOR = '0';

	const revert = {};

	try {
		// we need to temporarily rename package names before we call yarn
		await Promise.all(workspaces.map(async ws => {
			const pkgJsonFile = path.join(pluginsDir, ws, 'package.json');
			const pkgJson = await fs.readJson(pkgJsonFile);
			const newName = `${pkgJson.name}-${pkgJson.version.replace(/[^\w]/g, '_')}`;
			revert[newName] = { name: pkgJson.name, pkgJsonFile };
			logger.log(`Renaming package name ${highlight(pkgJson.name)} => ${highlight(newName)}`);
			pkgJson.name = newName;
			await fs.outputJson(pkgJsonFile, pkgJson);
		}));

		if (typeof fn === 'function') {
			await fn();
		}

		// run yarn
		const args = [ yarn, '--no-lockfile', '--no-progress', '--non-interactive', '--production' ];
		const cmd = process.platform === 'win32' ? args.shift() : process.execPath;
		logger.log(`Plugins dir: ${highlight(pluginsDir)}`);
		logger.log(`Executing: ${highlight(`${cmd} ${args.join(' ')}`)}`);

		const child = await spawnNode({
			args,
			nodeHome: expandPath(home, 'node'),
			opts: {
				cwd: pluginsDir,
				stdio: 'pipe',
				windowsHide: true
			},
			version: appcdCoreNodejs
		});

		await new Promise(resolve => {
			const print = data => data.toString().split(/\r\n|\n/).forEach(line => logger.log(line));
			child.stdout.on('data', print);
			child.stderr.on('data', print);
			child.on('close', code => {
				logger.warn(`yarn exited with code ${highlight(code)}`);
				resolve();
			});
		});
	} finally {
		process.env.PATH = origPath;
		process.env.FORCE_COLOR = origForceColor;

		// restore the plugin names in the package.json files
		await Promise.all(Object.values(revert).map(async ({ name, pkgJsonFile }) => {
			const pkgJson = await fs.readJson(pkgJsonFile);
			await pruneDir(path.join(pluginsDir, 'node_modules', `${pkgJson.name}`), pluginsDir);

			logger.log(`Restoring package name ${highlight(pkgJson.name)} => ${highlight(name)}`);
			pkgJson.name = name;
			await fs.outputJson(pkgJsonFile, pkgJson, { spaces: 2 });
		}));
	}
}

/**
 * Uninstalls a plugin. If the plugin name does not contain a version, then all versions of that
 * plugin are removed.
 *
 * @param {Object} params - Various parameters.
 * @param {String} params.home - The path to the appcd home directory.
 * @param {Array.<String>} params.plugins - One or more plugins to uninstall.
 * @returns {HookEmitter}
 */
export function uninstall({ home, plugins }) {
	const emitter = new HookEmitter();

	setImmediate(async () => {
		try {
			if (!home) {
				home = loadConfig().get('home');
			} else if (typeof home !== 'string') {
				throw new TypeError('Expected home directory to be a non-empty string');
			}

			if (!plugins || !Array.isArray(plugins) || plugins.some(p => !p || typeof p !== 'string')) {
				throw new TypeError('Expected plugins to be an array of plugin names');
			}

			const yarn = await findYarn();
			const pluginsDir = expandPath(home, 'plugins');
			const pluginMap = {};
			const { installed, workspaces } = await detectInstalled(pluginsDir);
			const toRemove = [];

			for (const plugin of unique(plugins)) {
				const { name, fetchSpec } = npa(plugin);
				pluginMap[name] = fetchSpec;
			}

			// build the list of directories to remove
			for (const [ name, vers ] of Object.entries(installed)) {
				for (const [ version, dir ] of Object.entries(vers)) {
					if (pluginMap[name] && (pluginMap[name] === 'latest' || semver.eq(pluginMap[name], version))) {
						toRemove.push({
							name,
							version,
							path: dir
						});
						workspaces.delete(`packages/${name}/${version}`);
					}
				}
			}

			if (!toRemove.length) {
				throw new Error(`No plugins found matching "${plugins.join('", "')}"`);
			}

			// delete the plugin version directory
			for (const plugin of toRemove) {
				await emitter.emit('uninstall', plugin);
				await pruneDir(plugin.path, pluginsDir);
			}

			await updateMonorepo({
				fn: () => emitter.emit('cleanup'),
				home,
				workspaces: Array.from(workspaces),
				yarn
			});

			await emitter.emit('finish', toRemove);
		} catch (err) {
			await emitter.emit('error', err);
		}
	});

	return emitter;
}

/**
 * Checks a npm package manifest to ensure it's an appcd plugin and whether there are any issues.
 *
 * @param {Object} manifest - The npm package manifest.
 * @returns {Object} The original manifest object.
 */
function validateManifest(manifest) {
	if (!manifest.appcd) {
		throw new Error(`${manifest.name}@${manifest.version} is not an appcd plugin`);
	}

	// old plugins didn't have an api version, so default it to 1.x
	if (!manifest.appcd.apiVersion) {
		manifest.appcd.apiVersion = '1.x';
	}

	manifest.issues = {};

	if (manifest.appcd.os && !manifest.appcd.os.includes(process.platform)) {
		manifest.issues.platform = `Plugin ${manifest.name}@${manifest.version} is not compatible with the current platform`;
	}

	if (manifest.appcd.apiVersion && !semver.satisfies(appcdPluginAPIVersion, manifest.appcd.apiVersion)) {
		manifest.issues.apiVersion = `${manifest.name}@${manifest.version} is not compatible with plugin API version ${appcdPluginAPIVersion}`;
	}

	if (manifest.appcd.appcdVersion && !semver.satisfies(appcdCoreVersion, manifest.appcd.appcdVersion)) {
		manifest.issues.appcdVersoin = `${manifest.name}@${manifest.version} is not compatible with Appcd Core version ${appcdCoreVersion}`;
	}

	manifest.supported = Object.keys(manifest.issues).length === 0;

	return manifest;
}

/**
 * Retrieves an appcd plugin package info from npm. If the package does not exist or is not an
 * appcd plugin, an error is thrown.
 *
 * @param {String} plugin - The name of the plugin to fetch the info for.
 * @returns {Object}
 */
export async function view(plugin) {
	if (!plugin || typeof plugin !== 'string') {
		throw new TypeError('Expected plugin name to be a non-empty string');
	}
	return await getPluginPackument(plugin);
}
