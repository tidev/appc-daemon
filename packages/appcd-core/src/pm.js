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

export async function list() {
	//
}

export async function search(criteria) {
	criteria = (Array.isArray(criteria) ? criteria : [ criteria ]).filter(Boolean);
	const { version } = await fs.readJson(path.resolve(__dirname, '..', 'package.json'));
	const keywords = new Set([ 'appcd', 'appcd-plugin', ...criteria ]);
	const limit = promiseLimit(10);
	const packages = await npmsearch(Array.from(keywords));
	const results = [];

	await Promise.all(packages.map(pkg => limit(async () => {
		const manifest = await pacote.manifest(pkg.name, { fullMetadata: true });
		if (manifest?.appcd) {
			// old plugins didn't have an api version, so default it to 1.x
			if (!manifest.appcd.apiVersion) {
				manifest.appcd.apiVersion = '1.x';
			}

			const reasons = [];
			if (manifest.appcd.os && !manifest.appcd.os.includes(process.platform)) {
				reasons.push(`Unsupported platform "${process.platform}"`);
			} else if (manifest.appcd.apiVersion && !semver.satisfies(appcdPluginAPIVersion, manifest.appcd.apiVersion)) {
				reasons.push(`Incompatible plugin API v${appcdPluginAPIVersion}`);
			} else if (manifest.appcd.appcdVersion && !semver.satisfies(version, manifest.appcd.appcdVersion)) {
				reasons.push(`Incompatible with Appcd v${version}`);
			}
			manifest.appcd.supported = !reasons.length;
			if (reasons.length) {
				manifest.appcd.unsupportedReasons = reasons;
			}

			results.push(manifest);
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
	return await pacote.manifest(pkg, { fullMetadata: true });
}
