/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

export { default } from './agent';
