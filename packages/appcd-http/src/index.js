/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Router from './router';
import WebServer from './webserver';
import WebSocket from 'ws';

export default WebServer;
export { Router, WebServer, WebSocket };
