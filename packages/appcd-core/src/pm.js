import fs from 'fs-extra';
import globalModules from 'global-modules';
import npmsearch from 'libnpmsearch';
import pacote from 'pacote';
import path from 'path';
import promiseLimit from 'promise-limit';
import semver from 'semver';

import { appcdPluginAPIVersion } from 'appcd-plugin';
import { expandPath } from 'appcd-path';
import { loadConfig } from './config';
import { version } from '../package.json';

/*
await installDefaultPlugins(path.join(homeDir, 'plugins'));
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

	if (!manifest.appcd) {
		const e = new Error(`${pkg} is not an appcd plugin`);
		e.code = 'ENOAPPCD';
		throw e;
	}

	// old plugins didn't have an api version, so default it to 1.x
	if (!manifest.appcd.apiVersion) {
		manifest.appcd.apiVersion = '1.x';
	}

	manifest.issues = [];

	if (manifest.appcd.os && !manifest.appcd.os.includes(process.platform)) {
		manifest.issues.push(`${pkg} does not support platform "${process.platform}"`);
	}

	if (manifest.appcd.apiVersion && !semver.satisfies(appcdPluginAPIVersion, manifest.appcd.apiVersion)) {
		manifest.issues.push(`${pkg} is not compatible with plugin API version ${appcdPluginAPIVersion}`);
	}

	const { version } = await fs.readJson(path.resolve(__dirname, '..', 'package.json'));
	if (manifest.appcd.appcdVersion && !semver.satisfies(version, manifest.appcd.appcdVersion)) {
		manifest.issues.push(`${pkg} is not compatible with Appcd Core version ${version}`);
	}

	manifest.supported = manifest.issues.length === 0;

	return manifest;
}

export function getPluginPaths(cfg) {
	if (!cfg) {
		cfg = loadConfig();
	}

	return [
		// globally installed plugins
		expandPath(cfg.get('home'), 'plugins', 'packages'),

		// global npm directory
		globalModules
	];
}

export async function install() {
	//
}

export async function list(cfg) {
	const paths = getPluginPaths(cfg);

	console.log(paths);

	return [];
}

export async function search(criteria) {
	criteria = (Array.isArray(criteria) ? criteria : [ criteria ]).filter(Boolean);
	const keywords = new Set([ 'appcd', 'appcd-plugin', ...criteria ]);
	const limit = promiseLimit(10);
	const packages = await npmsearch(Array.from(keywords));
	const results = [];

	await Promise.all(packages.map(pkg => limit(async () => {
		try {
			results.push(await getPluginManifest(pkg.name));
		} catch (e) {
			// silence
		}
	})));

	return results;
}

export async function uninstall(pkg) {
	//
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
	return await getPluginManifest(pkg);
}
