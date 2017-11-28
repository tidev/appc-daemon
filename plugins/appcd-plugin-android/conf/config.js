module.exports = {
	android: {
		adb: {
			install: {
				/**
				 * The number of milliseconds to wait before installing an app times out.
				 * @type {Number}
				 */
				timeout: null
			},

			/**
			 * The port number ADB is listening.
			 * @type {Number}
			 */
			port: null,

			start: {
				/**
				 * The number of milliseconds to wait before retrying to start ADB.
				 * @type {Number}
				 */
				retryInterval: null,

				/**
				 * The number of milliseconds to wait before starting ADB times out.
				 * @type {Number}
				 */
				timeout: null
			}
		},

		avd: {
			/**
			 * The path to where AVDs are stored.
			 * @type {Number}
			 */
			path: null
		},

		emulator: {
			start: {
				/**
				 * The number of milliseconds to wait before starting the Android emulator times out.
				 * @type {Number}
				 */
				timeout: null
			}
		},

		env: {
			/**
			 * An override for the `PATH` environment variable.
			 * @type {String}
			 */
			path: null
		},

		executables: {
			/**
			 * The path to the ADB executable.
			 * @type {String}
			 */
			adb: null
		},

		genymotion: {
			executables: {
				/**
				 * The path to the genymotion executable.
				 * @type {String}
				 */
				genymotion: null,

				/**
				 * The path to the genymotion player executable.
				 * @type {String}
				 */
				player: null
			},

			/**
			 * A list of paths to search for Genymotion.
			 * @type {Array.<String>}
			 */
			searchPaths: null
		},

		ndk: {
			/**
			 * A list of paths to search for Android NDKs.
			 * @type {Array.<String>}
			 */
			searchPaths: null
		},

		sdk: {
			/**
			 * A list of paths to search for Android SDKs.
			 * @type {Array.<String>}
			 */
			searchPaths: null
		},

		virtualbox: {
			/**
			 * The path to VirtualBox's XML config file.
			 * @type {String}
			 */
			configFile: null,

			executables: {

				/**
				 * The path to the `vboxmanage` executable.
				 * @type {String}
				 */
				vboxmanage: null,
			},

			/**
			 * A list of paths to search for VirtualBox.
			 * @type {Array.<String>}
			 */
			searchPaths: null
		}
	}
};
