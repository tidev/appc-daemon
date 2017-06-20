import path from 'path';

import {
	detectScheme,
	InvalidScheme,
	PluginScheme,
	PluginsDirScheme,
	NestedPluginsDirScheme
} from '../dist/schemes';

describe('Scheme', () => {
	it('should detect path as invalid', () => {
		expect(detectScheme(path.join(__dirname, 'fixtures', 'empty'))).to.equal(InvalidScheme);
	});

	it('should detect path as a plugin directory', () => {
		expect(detectScheme(path.join(__dirname, 'fixtures', 'good'))).to.equal(PluginScheme);
	});

	it('should detect path as directory of plugin directories', () => {
		expect(detectScheme(path.join(__dirname, 'fixtures', 'plugin-dir'))).to.equal(PluginsDirScheme);
	});

	it('should detect path as directory of directories of plugin directories', () => {
		expect(detectScheme(path.join(__dirname, 'fixtures', 'plugin-dir2'))).to.equal(NestedPluginsDirScheme);
	});
});
