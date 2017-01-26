import 'source-map-support/register';

import Server from './server';

global.appcd = new Server();
appcd.run(process.argv.slice(2));
