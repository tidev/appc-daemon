if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Router from './router';
import WebServer from './webserver';

export default WebServer;
export { Router, WebServer };
