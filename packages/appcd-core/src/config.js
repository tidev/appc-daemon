/* eslint-disable quote-props */

import AppcdConfig, { Joi } from 'appcd-config';
import fs from 'fs-extra';
import path from 'path';

import { expandPath } from 'appcd-path';

const defaults = fs.readJSONSync(path.resolve(__dirname, '..', 'conf', 'default.json'));

const schema = Joi.object({
	'core': Joi.object({
		'enforceNodeVersion': Joi.boolean()
			.description('When `true`, enforces the Node.js version required by the core. If the required Node.js version is not installed, then the required version is downloaded. When `false`, it will use the current Node.js version which may be incompatible with the core.')
			.default(defaults.core.enforceNodeVersion)
			.meta({ readonly: true }),

		'v8': Joi.object({
			'memory': Joi.alternatives()
				.try(
					Joi.string().valid('auto'),
					Joi.number().min(10)
				)
				.description('The maximum amount of memory the spawned appcd core process should allocate. The value must either be the number of megabytes or the string `"auto"`, which will automatically select a sensible size based on the system architecture and installed memory.')
				.default(defaults.core.v8.memory)
				.meta({ readonly: true })
		})
	}),

	'environment': Joi.object({
		'name': Joi.string()
			.description('Shorthand environment name used for loading the environment-specific config file. This value is sent in the `ti.start` telemetry data payload. This value is not the same as the `telemetry.environment`.')
			.default(defaults.environment.name)
			.meta({ readonly: true }),

		'title': Joi.string()
			.default(defaults.environment.title)
			.description('Title for the environment used in debug logging when the daemon starts.')
	}),

	'home': Joi.string()
		.description('The path to the `appcd` home directory containing user-defined config files and plugins.')
		.default(defaults.home)
		.meta({ env: 'APPCD_HOME', readonly: true }),

	'network': Joi.object({
		'agentOptions': Joi.object()
			.description('Additional agent options to pass directly into `request`.')
			.default(defaults.network.agentOptions)
			.allow(null),

		'caFile': Joi.string()
			.description('Path to a pem file containing one or more certificate authorities.')
			.default(defaults.network.caFile)
			.allow(null)
			.meta({ env: 'APPCD_NETWORK_CA_FILE' }),

		'certFile': Joi.string()
			.description('Path to a cert file.')
			.default(defaults.network.certFile)
			.allow(null),

		'httpProxy': Joi.string()
			.description('The proxy URL to use for outgoing HTTP network requests.')
			.default(defaults.network.httpProxy)
			.allow(null)
			.meta({ env: 'HTTP_PROXY' }),

		'httpsProxy': Joi.string()
			.description('The secure proxy URL to use for outgoing HTTPS network requests.')
			.default(defaults.network.httpsProxy)
			.allow(null)
			.meta({ env: 'HTTPS_PROXY' }),

		'keyFile': Joi.string()
			.description('Path to a private key file.')
			.default(defaults.network.keyFile)
			.allow(null),

		'passphrase': Joi.string()
			.description('The private key\'s passphrase.')
			.default(defaults.network.passphrase)
			.allow(null),

		'strictSSL': Joi.boolean()
			.description('Enforces SSL certificates to be valid. Note that the `APPCD_NETWORK_STRICT_SSL` environment variable overrides this value.')
			.default(defaults.network.strictSSL)
			.meta({ env: 'APPCD_NETWORK_STRICT_SSL' })
	}),

	'plugins': Joi.object({
		'autoReload': Joi.boolean()
			.description('Stops `external` plugins when one of its files is changed.')
			.default(defaults.plugins.autoReload),

		'defaultInactivityTimeout': Joi.number()
			.description('The default number of milliseconds of inactivity before an `external` plugin is deactivated.')
			.default(defaults.plugins.defaultInactivityTimeout)
			.min(0)
	}),

	'server': Joi.object({
		'agentPollInterval': Joi.number()
			.description('The number of milliseconds to have the agents poll for system health.')
			.default(defaults.server.agentPollInterval)
			.min(0),

		'daemonize': Joi.boolean()
			.description('Launches the server as a background process.')
			.default(defaults.server.daemonize)
			.meta({ readonly: true }),

		'group': Joi.alternatives()
			.try(
				Joi.number().min(0),
				Joi.string()
			)
			.description('The group to switch to when the daemon is started as root on a POSIX system.')
			.default(defaults.server.group)
			.allow(null)
			.meta({ readonly: true }),

		'hostname': Joi.string()
			.description('The hostname or IP address to listen on.')
			.default(defaults.server.hostname)
			.meta({ readonly: true }),

		'nodejsMaxUnusedAge': Joi.number()
			.description('The max age in milliseconds an unused Node.js executable should be kept before it\'s purged.')
			.default(defaults.server.nodejsMaxUnusedAge)
			.meta({ readonly: true }),

		'persistDebugLog': Joi.boolean()
			.description('When `true`, writes the debug log to disk. Each time the Appc Daemon starts when logging is enabled or when logging is enabled at runtime, it creates a new log file. Log files are stored in `"{{home}}/logs"`.')
			.note('Old log files are _not_ automatically cleaned up which is partially why persisting debug logs is disabled by default.')
			.default(defaults.server.persistDebugLog),

		'pidFile': Joi.string()
			.description('Path to the daemon\'s pid (process id) file.')
			.default(defaults.server.pidFile)
			.meta({ readonly: true }),

		'port': Joi.number()
			.description('The port number to listen on. The port number must be between `1024` and `65535`.')
			.default(defaults.server.port)
			.min(1024)
			.max(65535)
			.meta({ env: 'APPCD_SERVER_PORT', readonly: true }),

		'user': Joi.alternatives()
			.try(
				Joi.number().min(0),
				Joi.string()
			)
			.description('The user to switch to when the daemon is started as root on a POSIX system.')
			.default(defaults.server.user)
			.allow(null)
			.meta({ readonly: true })
	}),

	'telemetry': Joi.object({
		'app': Joi.string()
			.description('The Appc Daemon app GUID to send with each event.')
			.default(defaults.telemetry.app)
			.guid(),

		'enabled': Joi.boolean()
			.description('Turns on telemetry recording and submitting.')
			.default(defaults.telemetry.enabled)
			.meta({ env: 'APPCD_TELEMETRY' }),

		'environment': Joi.string()
			.description('Deploy type for the analytics events.')
			.default(defaults.telemetry.environment),

		'eventsDir': Joi.string()
			.description('The path store unsent telemetry events.')
			.default(defaults.telemetry.eventsDir),

		'sendBatchSize': Joi.number()
			.description('The maximum number of events to send at a time.')
			.default(defaults.telemetry.sendBatchSize)
			.min(0),

		'sendInterval': Joi.number()
			.description('The number of milliseconds to wait before checking if there are enough telemetry events to batch send.')
			.default(defaults.telemetry.sendInterval)
			.min(0),

		'sendTimeout': Joi.number()
			.description('The number of milliseconds to wait before timing out sending telementry events.')
			.default(defaults.telemetry.sendTimeout)
			.min(0),

		'url': Joi.string()
			.description('The URL to send the telemetry events to.')
			.default(defaults.telemetry.url)
	})
});

/**
 * Initializes the Appc Daemon configuration, loads the default and user-defined config files, and
 * applies the command line runtime configuration.
 *
 * @param {Object} [opts] - Various options.
 * @param {Object} [opts.config] - A object to initialize the config with. Note that if a
 * `configFile` is also specified, this `config` is applied AFTER the config file has been loaded.
 * @param {String} [opts.configFile] - The path to a .js or .json config file to load.
 * @returns {AppcdConfig}
 */
export function loadConfig({ config, configFile } = {}) {
	// validate the config options
	if (config && (typeof config !== 'object' || Array.isArray(config))) {
		throw new TypeError('Expected config to be an object');
	}

	if (configFile && typeof configFile !== 'string') {
		throw new TypeError('Expected config file to be a string');
	}

	const cfg = new AppcdConfig({ data: config, schema });

	// load the user-defined config file
	try {
		cfg.load(expandPath(configFile || path.join(cfg.get('home'), 'config.json')));
	} catch (e) {
		if (e.code !== 'ENOENT') {
			throw e;
		}
	}

	return cfg;
}
