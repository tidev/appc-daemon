import semver from 'semver';

/**
 * The Appc Daemon plugin API version.
 * @type {String}
 */
export const appcdPluginAPIVersion = '2.0.0';
export default appcdPluginAPIVersion;

/**
 * A map of plugin API versions to Node.js versions.
 * @type {Object}
 */
export const appcdPluginAPINodejsLookup = {
	// IMPORTANT!
	// these must be sorted descending
	'2.0.x': '14.15.4',
	'1.x':   '10.16.3'
};

/**
 * Attempts to find a Node.js version that best matches a plugin's supported appcd plugin API
 * version.
 *
 * @param {String} [apiVersion] - The appcd plugin API version range.
 * @returns {String}
 */
export function getNodeVersionForPluginAPIVersion(apiVersion) {
	if (apiVersion) {
		for (const [ ver, node ] of Object.entries(appcdPluginAPINodejsLookup)) {
			if (semver.intersects(ver, apiVersion)) {
				return node;
			}
		}
	}
}
