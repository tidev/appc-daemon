/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

export { appcdPluginAPIVersion } from './plugin-api-version';
export { default } from './plugin-manager';
export { detectScheme } from './schemes';
