/**
 * This postinstall script will stop the Appc Daemon, then attempt to install the default plugins.
 *
 * If `appcd` was installed via `axway pm i appcd`, then there shouldn't be any issues.
 *
 * However, if `appcd` was installed via `npm i -g appcd`, then this postinstall script will either
 * be run as the current user, root, or nobody.
 *
 * If the user is the current user (or platform is Windows), just install the default plugins.
 *
 * If the user is root, find out the correct user and install the default plugins using that user.
 *
 * If the user is noobody, display the manual install message.
 */

const { expandPath } = require('appcd-path');
const { snooplogg } = require('appcd-logger');
const { cyan, yellow } = snooplogg.chalk;
const { spawnSync } = require('child_process');
const spawnOpts = {
	env: {
		...process.env,
		NO_UPDATE_NOTIFIER: 1
	},
	stdio: 'inherit'
};
const appcd = expandPath(`${__dirname}/../bin/appcd`);

console.log(cyan('Appc Daemon Postinstall Script\n'));

// step 1: stop the server if it's running
console.log('Stopping the Appc Daemon..');
spawnSync(process.execPath, [ appcd, '--no-banner', 'stop' ], spawnOpts);

// step 2: load the config so we can find the appcd home directory
const { loadConfig } = require('appcd-core');
const home = expandPath(loadConfig().get('home'));

try {
	// step 3: determine the correct user
	if (process.platform !== 'win32') {
		const inferOwner = require('infer-owner');
		const owner = inferOwner.sync(home);
		const current = process.getuid();

		if (process.env.SUDO_UID) {
			// sudo
			spawnOpts.uid = process.env.SUDO_UID;
			spawnOpts.gid = process.env.SUDO_GID;
		} else {
			// current user or nobody
			spawnOpts.uid = current;
			spawnOpts.gid = process.getgid();
		}

		if (spawnOpts.uid === 0) {
			// root
			spawnOpts.uid = owner.uid;
			spawnOpts.gid = owner.gid;
		}

		if (spawnOpts.uid !== current) {
			throw new Error('Current user is not the owner of the appcd home dir');
		}
	}

	// step 4: install the default plugins
	console.log(`\nInstalling default plugins...${spawnOpts.uid ? ` (uid ${spawnOpts.uid})` : ''}`);
	spawnSync(process.execPath, [ appcd, '--no-banner', 'pm', 'install', 'default' ], spawnOpts);
} catch (e) {
	// step ?: fall back to the manual install message
	const boxen = require('boxen');
	console.log(boxen(`${yellow('ATTENTION!')}

Please manually install the default appcd plugins by running:

${cyan('appcd pm install default')}`, {
		align: 'center',
		borderColor: 'yellow',
		borderStyle: 'round',
		margin: { bottom: 1, left: 4, right: 4, top: 1 },
		padding: { bottom: 1, left: 4, right: 4, top: 1 }
	}));
}
