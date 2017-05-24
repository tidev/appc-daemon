/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import FSWatchManager from './fswatch-manager';

export default FSWatchManager;
export { FSWatchManager };
export * from './fswatcher';
