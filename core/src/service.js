/**
 * Base class to define a service.
 */
export default class Service {
	/**
	 * The namespace to use for all dispatcher endpoints, events, and log messages.
	 * Defaults to the name of the plugin from the `package.json`. If the name
	 * begins with "appcd-plugin-", it is stripped.
	 * @type {String}
	 */
	static namespace = null;

	/**
	 * Stub function for the service initialization.
	 */
	init() {
	}

	/**
	 * Stub function for the service shutdown.
	 */
	shutdown() {
	}

	/**
	 * Returns the service's status to be included in server status requests.
	 *
	 * @returns {Object}
	 * @access public
	 */
	getStatus() {
		return {};
	}
}
