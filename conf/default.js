module.exports = {
	analytics: {
		/**
		 * Turns on analytics.
		 * @type {Boolean}
		 */
		enabled: true,

		/**
		 * The path to the analytics cache directory.
		 * @type {String}
		 */
		eventsDir: '~/.appcelerator/appcd/analytics',

		/**
		 * The number of events to queue up before sending.
		 * @type {Number}
		 */
		sendBatchSize: 10,

		/**
		 * The URL to post the analytics events to.
		 * @type {String}
		 */
		url: 'https://api.appcelerator.net/p/v2/partner-track'
	},

	/**
	 * The path to the appcd home directory
	 * @type {String}
	 * @readonly
	 */
	home: '~/.appcelerator/appcd',

	logger: {
		/**
		 * Enables colors in the logging.
		 * @type {Boolean}
		 */
		colors: true,

		/**
		 * Silences all log output.
		 * @type {Boolean}
		 */
		silent: false
	},

	network: {
		/**
		 * Additional agent options to pass directly into `request`.
		 * @type {Object}
		 */
		agentOptions: null,

		/**
		 * Path to a pem file containing one or more certificate authorities.
		 * @type {String}
		 */
		caFile: null,

		/**
		 * Path to a cert file.
		 * @type {String}
		 */
		certFile: null,

		/**
		 * The proxy URL to use for all outgoing HTTP network requests.
		 * @type {String}
		 */
		httpProxy: null,

		/**
		 * The secure proxy URL to use for all outgoing HTTPS network requests.
		 * @type {String}
		 */
		httpsProxy: null,

		/**
		 * Path to a key file.
		 * @type {String}
		 */
		keyFile: null,

		/**
		 * The private key's passphrase.
		 * @type {String}
		 */
		passphrase: null,

		/**
		 * Enforces SSL certificates to be valid.
		 * @type {Boolean}
		 */
		strictSSL: true
	},

	plugins: [],

	server: {
		/**
		 * Launches the server as a background process
		 * @type {Boolean}
		 * @readonly
		 */
		daemonize: true,

		/**
		 * The hostname to listen on.
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
		 * The port to listen for incoming requests.
		 * @type {Number}
		 */
		port: 1732
	}
};
