import 'source-map-support/register';

import CLI from 'cli-kit';
import start from './start';
import stop from './stop';
import restart from './restart';
import exec from './exec';
import logcat from './logcat';
import status from './status';

new CLI({
	commands: {
		start,
		stop,
		restart,
		exec,
		logcat,
		status
	}
}).exec().catch(console.error);
