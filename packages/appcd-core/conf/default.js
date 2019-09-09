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
			 * The maximum amount of memory the spawned appcd core process should allocate. The
			 * value must either be the number of megabytes or the string `"auto"`, which will
			 * automatically select a sensible size based on the system architecture and installed
			 * memory.
			 * @type {Number|String}
			 * @readonly
			 */
			memory: 'auto'
		}
	},

	environment: {
		/**
		 * Shorthand environment name used for loading the environment-specific config file. This
		 * value is sent in the `ti.start` telemetry data payload. This value is not the same as
		 * the `telemetry.environment`.
		 * @type {String}
		 * @readonly
		 */
		name: 'prod',

		/**
		 * Title for the environment used in debug logging when the daemon starts.
		 * @type {String}
		 */
		title: 'Production'
	},

	/**
	 * The path to the `appcd` home directory containing user-defined config files and plugins.
	 * @readonly
	 * @type {String}
	 */
	home: '~/.appcelerator/appcd',

	network: {
		/**
		 * Additional agent options to pass directly into `request`.
		 * @type {?Object}
		 */
		agentOptions: null,

		/**
		 * Path to a pem file containing one or more certificate authorities. Note that the
		 * `APPCD_NETWORK_CA_FILE` environment variable overrides this value.
		 * @type {?String}
		 */
		caFile: null,

		/**
		 * Path to a cert file.
		 * @type {?String}
		 */
		certFile: null,

		/**
		 * The proxy URL to use for outgoing HTTP network requests. Note that the
		 * `APPCD_NETWORK_PROXY` environment variable overrides this value.
		 * @type {?String}
		 */
		httpProxy: null,

		/**
		 * The secure proxy URL to use for outgoing HTTPS network requests. Note that the
		 * `APPCD_NETWORK_PROXY` environment variable overrides this value.
		 * @type {?String}
		 */
		httpsProxy: null,

		/**
		 * Path to a private key file.
		 * @type {?String}
		 */
		keyFile: null,

		/**
		 * The private key's passphrase.
		 * @type {?String}
		 */
		passphrase: null,

		/**
		 * Enforces SSL certificates to be valid. Note that the `APPCD_NETWORK_STRICT_SSL`
		 * environment variable overrides this value.
		 * @type {Boolean}
		 */
		strictSSL: true
	},

	plugins: {
		/**
		 * Stops `external` plugins when one of its files is changed.
		 * @type {Boolean}
		 */
		autoReload: true,

		/**
		 * The default number of milliseconds of inactivity before an `external` plugin is
		 * deactivated. Defaults to an hour.
		 * @type {Number}
		 */
		defaultInactivityTimeout: 60 * 60 * 1000,

		/**
		 * Ensures that the default plugins are installed in the appcd home directory. This
		 * operation requires both an Internet connection and write permissions to the appcd home
		 * directory.
		 * @type {Boolean}
		 * @readonly
		 */
		installDefault: true
	},

	server: {
		/**
		 * The number of milliseconds to have the agents poll for system health.
		 * @type {Number}
		 */
		agentPollInterval: 1000,

		/**
		 * Launches the server as a background process.
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
		 * @readonly
		 */
		nodejsMaxUnusedAge: 90 * 24 * 60 * 60 * 1000,

		/**
		 * When `true`, writes the debug log to disk. Each time the Appc Daemon starts when
		 * logging is enabled or when logging is enabled at runtime, it creates a new log file.
		 * Log files are stored in `"{{home}}/logs"`.
		 *
		 * Note: Old log files are _not_ automatically cleaned up which is partially why
		 * persisting debug logs is disabled by default.
		 * @type {Boolean}
		 */
		persistDebugLog: false,

		/**
		 * Path to the daemon's pid (process id) file.
		 * @type {String}
		 * @readonly
		 */
		pidFile: '{{home}}/appcd.pid',

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
		 * The Appc Daemon app GUID to send with each event.
		 * @type {String}
		 */
		app: 'ea327577-858f-4d31-905e-fa670f50ef48',

		/**
		 * Turns on telemetry recording and submitting.
		 * @type {Boolean}
		 */
		enabled: true,

		/**
		 * Deploy type for the analytics events.
		 * @type {String}
		 */
		environment: 'production',

		/**
		 * The path store unsent telemetry events.
		 * @type {String}
		 */
		eventsDir: '{{home}}/telemetry',

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
		 * The URL to send the telemetry events to.
		 * @type {String}
		 */
		url: 'https://api.appcelerator.com/p/v4/app-track'
	}
};
