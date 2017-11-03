/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

export { default as default } from './detect-engine';
export { default as Detector } from './detector';
