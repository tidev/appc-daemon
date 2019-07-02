try {
	const os = require('os');
	const { createInstanceWithDefaults, StdioStream } = require('snooplogg');
	const { installDefaultPlugins } = require('./dist/index');

	const logger = createInstanceWithDefaults()
		.snoop()
		.config({
			maxBufferSize: 1000,
			minBrightness: 80,
			maxBrightness: 200
		})
		.enable('*')
		.pipe(new StdioStream(), { flush: true })
		.ns('appcd:default-plugins:postinstall');

	installDefaultPlugins(`${os.homedir()}/.appcelerator/appcd/plugins`)
		.catch(err => {
			if (err.code === 'EACCES') {
				logger.warn(err);
			} else {
				logger.error(err);
				process.exit(1);
			}
		});
} catch (e) {}
