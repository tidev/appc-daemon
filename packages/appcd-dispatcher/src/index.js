/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Dispatcher from './dispatcher';

export default Dispatcher;
export { Dispatcher };
export { default as DispatcherError } from './dispatcher-error';
export { default as ServiceDispatcher } from './service-dispatcher';
