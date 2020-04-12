require('child_process').spawnSync(process.execPath, [ 'bin/appcd', 'stop', '--no-banner' ], { stdio: 'inherit' });

const boxen = require('boxen');
const { snooplogg } = require('appcd-logger');
const { cyan, yellow } = snooplogg.chalk;

console.log(boxen(`${yellow('GOT PLUGINS?')}

Install some default appcd plugins by running:

${cyan('appcd pm install default')}`, {
	align: 'center',
	borderColor: 'yellow',
	borderStyle: 'round',
	margin: { bottom: 1, left: 4, right: 4, top: 1 },
	padding: { bottom: 1, left: 4, right: 4, top: 1 }
}));
