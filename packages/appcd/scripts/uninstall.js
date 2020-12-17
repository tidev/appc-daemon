(async () => {
	const { spawnSync } = require('child_process');
	const path = require('path');
	const appcd = path.resolve(__dirname, '../bin/appcd');
	const run = (...args) => spawnSync(process.execPath, [ appcd, ...args ], { windowsHide: true });

	const { status, stdout } = run('status', '--json');
	if (status) {
		console.log('appcd not running, exiting');
		return;
	}

	const { version: uninstallingVersion } = require(path.resolve(__dirname, '../package.json'));
	const { version: runningVersion } = JSON.parse(stdout.toString());

	console.log(`Uninstalling version: ${uninstallingVersion}`);
	console.log(`Running version:      ${runningVersion}`);

	if (uninstallingVersion === runningVersion) {
		console.log('Stopping appcd...');
		const { status } = run('stop', '--force');
		console.log(`Stopped appcd (code ${status})`);
	}
})();
