import 'source-map-support/register';

import { assertNodeEngineVersion } from 'appcd-util';

assertNodeEngineVersion(`${__dirname}/../package.json`);
const Server = require('./server').default;
new Server().start();
