'use strict';

const path = require('path');

module.exports = {
	core: {
		v8: {
			/**
			 * The maximum amount of memory the spawned appcd-core process
			 * should allocate. The value must either be the number of megabytes
			 * or the string `auto`, which will automatically select a sensible
			 * size based on the system architecture and installed memory.
			 * @type {Number|String}
			 * @readonly
			 */
			memory: 'auto'
		}
	},

	/**
	 * The path to the appcd home directory
	 * @type {String}
	 * @readonly
	 */
	home: '~/.appcelerator/appcd',

	network: {
		/**
		 * Additional agent options to pass directly into `request`.
		 * @type {?Object}
		 */
		agentOptions: null,

		/**
		 * Path to a pem file containing one or more certificate authorities.
		 * @type {?String}
		 */
		caFile: null,

		/**
		 * Path to a cert file.
		 * @type {?String}
		 */
		certFile: null,

		/**
		 * The proxy URL to use for all outgoing HTTP network requests.
		 * @type {?String}
		 */
		httpProxy: null,

		/**
		 * The secure proxy URL to use for all outgoing HTTPS network requests.
		 * @type {?String}
		 */
		httpsProxy: null,

		/**
		 * Path to a key file.
		 * @type {?String}
		 */
		keyFile: null,

		/**
		 * The private key's passphrase.
		 * @type {?String}
		 */
		passphrase: null,

		/**
		 * Enforces SSL certificates to be valid.
		 * @type {Boolean}
		 */
		strictSSL: true
	},

	/**
	 * A list of plugins to load. Internal plugins are always loaded.
	 * @type {Array.<Object>}
	 */
	plugins: [],

	server: {
		/**
		 * The number of milliseconds to have the agents poll for system health.
		 * @type {Number}
		 */
		agentPollInterval: 1000,

		/**
		 * Launches the server as a background process
		 * @type {Boolean}
		 * @readonly
		 */
		daemonize: true,

		/**
		 * The group to switch to when the daemon is started as root on a POSIX system.
		 * @type {String|Number}
		 * @readonly
		 */
		group: null,

		/**
		 * The hostname or IP address to listen on.
		 * @type {String}
		 * @readonly
		 */
		hostname: '127.0.0.1',

		/**
		 * Path to the daemon's pid file.
		 * @type {String}
		 * @readonly
		 */
		pidFile: '~/.appcelerator/appcd/appcd.pid',

		/**
		 * The default number of milliseconds of inactivity before a plugin is deactivated.
		 * @type {Number}
		 */
		defaultPluginInactivityTimeout: 60 * 60 * 1000,

		/**
		 * The port to listen for incoming requests.
		 * @type {Number}
		 * @readonly
		 */
		port: 1732,

		/**
		 * The user to switch to when the daemon is started as root on a POSIX system.
		 * @type {?String|Number}
		 * @readonly
		 */
		user: null
	},

	telemetry: {
		/**
		 * Turns on telemetry recording and submitting.
		 * @type {Boolean}
		 */
		enabled: true,

		/**
		 * The path to the telemetry cache directory.
		 * @type {String}
		 */
		eventsDir: '~/.appcelerator/appcd/analytics',

		/**
		 * The number of events to queue up before sending.
		 * @type {Number}
		 */
		sendBatchSize: 10,

		/**
		 * The URL to post the telemetry events to.
		 * @type {String}
		 */
		url: 'https://api.appcelerator.net/p/v2/partner-track'
	}
};
