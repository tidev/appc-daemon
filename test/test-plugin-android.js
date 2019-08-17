import fs from 'fs-extra';
import path from 'path';
import {
	emptyHomeDir,
	runAppcdSync
} from './common';

const pluginPath = path.resolve(__dirname, '..', 'plugins', 'android');
const pluginVersion = fs.readJsonSync(path.join(pluginPath, 'package.json')).version;

// describe('plugin: android', function () {
// 	this.timeout(10000);

// 	before(() => {
// 		runAppcdSync([ 'stop' ]);
// 	});

// 	afterEach(() => {
// 		emptyHomeDir();
// 	});

// 	it('should register the android plugin', () => {
// 		const results = runAppcdSync([ 'exec', `/android/${pluginVersion}` ]);
// 		console.log(results);
// 	});
// });
