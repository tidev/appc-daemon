module.exports = {
	core: {
		/**
		 * When `true`, enforces the Node.js version required by the core. If the required Node.js
		 * version is not installed, then the required version is downloaded. When `false`, it will
		 * use the current Node.js version which may be incompatible with the core.
		 * @type {Boolean}
		 * @readonly
		 */
		enforceNodeVersion: true,

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

	environment: {
		/**
		 * Shorthand name for the environment.
		 * @type {String}
		 */
		name: 'prod',

		/**
		 * Title for the environment
		 * @type {String}
		 */
		title: 'Production'
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

	plugins: {
		/**
		 * Allow `external` plugins to be auto-reloaded when one of its files is changed.
		 * @type {Boolean}
		 */
		autoReload: true,

		/**
		 * The default number of milliseconds of inactivity before an `external` plugin is
		 * deactivated. Defaults to an hour.
		 * @type {Number}
		 */
		defaultInactivityTimeout: 60 * 60 * 1000
	},

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
		 * The max age in milliseconds an unused Node.js executable should be kept before it's
		 * purged. Defaults to 90 days.
		 * @type {Number}
		 */
		nodejsMaxUnusedAge: 90 * 24 * 60 * 60 * 1000,

		/**
		 * Path to the daemon's pid file.
		 * @type {String}
		 * @readonly
		 */
		pidFile: '~/.appcelerator/appcd/appcd.pid',

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
		 * Deploy type for the analytics events.
		 * @type {String}
		 */
		environment: 'production',

		/**
		 * Turns on telemetry recording and submitting.
		 * @type {Boolean}
		 */
		enabled: true,

		/**
		 * The path to the telemetry cache directory.
		 * @type {String}
		 */
		eventsDir: '~/.appcelerator/appcd/telemetry',

		/**
		 * GUID to use for telemetry.
		 * @type {String}
		 */
		guid: 'ea327577-858f-4d31-905e-fa670f50ef48',

		/**
		 * The maximum number of events to send at a time.
		 * @type {Number}
		 */
		sendBatchSize: 10,

		/**
		 * The number of milliseconds to wait before checking if there are enough telemetry events
		 * to batch send.
		 * @type {Number}
		 */
		sendInterval: 60000,

		/**
		 * The number of milliseconds to wait before timing out sending telementry events.
		 * @type {Number}
		 */
		sendTimeout: 60000,

		/**
		 * The URL to post the telemetry events to.
		 * @type {String}
		 */
		url: 'https://api.appcelerator.com/p/v4/app-track'
	}
};
