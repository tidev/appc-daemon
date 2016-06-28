import appc from 'node-appc';
import fs from 'fs';
import os from 'os';

/**
 * Detects the operating system information. This information is virtually
 * static, so it's a simple detect.
 *
 * @returns {Promise}
 */
export default function detect() {
	return appc.util.cache('system-info/os', () => {
		return Promise.resolve()
			.then(() => {
				switch (process.platform) {
					case 'darwin':
						return appc.subprocess.run('sw_vers')
							.then(({ stdout }) => {
								const name = stdout.match(/ProductName:\s+(.+)/i);
								const ver = stdout.match(/ProductVersion:\s+(.+)/i);
								return {
									name: name && name[1],
									ver: ver && ver[1]
								};
							});

					case 'linux':
						const results = {
							name: 'GNU/Linux',
							ver: ''
						};

						if (appc.fs.isFile('/etc/lsb-release')) {
							const contents = fs.readFileSync('/etc/lsb-release').toString();
							const name = contents.match(/DISTRIB_DESCRIPTION=(.+)/i);
							const ver = contents.match(/DISTRIB_RELEASE=(.+)/i);
							name && name[1] && (results.name = name[1].replace(/"/g, ''));
							ver && ver[1] && (results.ver = ver[1].replace(/"/g, ''));
						} else if (fs.existsSync('/etc/system-release')) {
							const parts = fs.readFileSync('/etc/system-release').toString().split(' ');
							parts[0] && (results.name = parts[0]);
							parts[2] && (results.ver = parts[2]);
						}

						return results;

					case 'win32':
						return appc.subprocess.run('wmic', ['os', 'get', 'Caption,Version'])
							.then(({ stdout }) => {
								const s = stdout.split('\n')[1].split(/ {2,}/);
								return {
									name: s.length > 0 && s[0].trim() || 'Windows',
									ver: s.length > 1 && s[1].trim() || ''
								};
							});
				}
			})
			.catch(err => Promise.resolve())
			.then(osInfo => ({
				platform: process.platform,
				name:     osInfo && osInfo.name || 'Unknown',
				version:  osInfo && osInfo.ver || '',
				arch:     (/64/.test(process.arch) ? 64 : 32) + 'bit',
				numcpus:  os.cpus().length,
				memory:   os.totalmem()
			}));
	});
}
