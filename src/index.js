import { existsSync, expandPath } from './util';
import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
import resolvePath from 'resolve-path';
import semver from 'semver';
import 'source-map-support/register';

/**
 * Detects all installed appc-daemon-core modules.
 * @param {String} appcdHome - The path to the appcd home directory.
 * @returns {Object} Map of versions to appc-daemon-core descriptors.
 */
export function detectCores(appcdHome) {
	const coresDir = path.join(appcdHome, 'packages', 'appc-daemon-core');
	const cores = {};

	let dirs = [];
	try {
		if (fs.statSync(coresDir).isDirectory()) {
			dirs = fs.readdirSync(coresDir);
		}
	} catch (e) {
		// squeltch
	}
	dirs.push(path.join(__dirname, '..', 'core'));

	// get all globally installed cores
	dirs.forEach(coreDir => {
		try {
			let pkgJson = JSON.parse(fs.readFileSync(path.join(coreDir, 'package.json')));
			if (!pkgJson || typeof pkgJson !== 'object') {
				pkgJson = {};
			}

			// we require a version
			if (!pkgJson.version) {
				return;
			}

			const main = pkgJson.main || 'index.js';
			let mainFile = main;
			if (!/\.js$/.test(mainFile)) {
				mainFile += '.js';
			}

			mainFile = resolvePath(coreDir, mainFile);
			if (existsSync(mainFile)) {
				cores[pkgJson.version] = {
					pkgJson,
					main: mainFile,
					path: coreDir
				};
			}
		} catch (e) {
			// squeltch
		}
	});

	return cores;
}

/**
 * Finds a appc-daemon-core module.
 * @param {Object} [opts] - Various options.
 * @param {String} [opts.version] - The appc-daemon-core version to load or `latest`.
 * @param {String} [opts.appcdHome='~/.appcelerator/appcd'] - Path to the appcd home directory.
 * @returns {Object} The appc-daemon-core descriptor.
 */
export function findCore(opts = {}) {
	const appcdHome = expandPath(opts.appcdHome || '~/.appcelerator/appcd');
	let version = opts.version;

	if (!version) {
		// no explicit version, check the selected version
		const versionFile = path.join(appcdHome, '.core_version');
		if (existsSync(versionFile)) {
			version = fs.readFileSync(versionFile).toString().split('\n').shift().trim();
		}
		if (!version) {
			version = 'latest';
		}
	}

	const cores = detectCores(appcdHome);
	const versions = Object.keys(cores);
	if (!versions.length) {
		throw new Error('Unable to find any daemon cores');
	}

	let core = cores[version];
	if (!core && version === 'latest') {
		core = cores[versions.sort().pop()];
	}

	if (!core) {
		throw new Error(`Unable to find appc daemon core "${version}"`);
	}

	return core;
}

/**
 * Finds and loads an appc-daemon-core module.
 * @param {Object} [opts] - Various options.
 * @param {String} [opts.version] - The appc-daemon-core version to load or `latest`.
 * @param {String} [opts.appcdHome='~/.appcelerator/appcd'] - Path to the appcd home directory.
 * @returns {Promise}
 */
export function loadCore(opts = {}) {
	return Promise.resolve()
		.then(() => {
			const core = findCore(opts);

			const nodeVer = core.pkgJson.engines && core.pkgJson.engines.node;
			if (nodeVer && !semver.satisfies(process.version, nodeVer)) {
				throw new Error('Appcelerator Daemon requires Node.js ' + semver.validRange(nodeVer));
			}

			return require(core.main);
		});
}

/**
 * Saves the specified appc-daemon-core version.
 * @param {Object} [opts] - Various options.
 * @param {String} [opts.version] - The appc-daemon-core version to load or `latest`.
 * @param {String} [opts.appcdHome='~/.appcelerator/appcd'] - Path to the appcd home directory.
 * @returns {Promise}
 */
export function switchCore(opts = {}) {
	return Promise.resolve()
		.then(() => {
			const core = findCore(opts);
			const appcdHome = expandPath(opts.appcdHome || '~/.appcelerator/appcd');
			mkdirp.sync(appcdHome);
			fs.writeFileSync(path.join(appcdHome, '.core_version'), core.pkgJson.version);
		});
}
