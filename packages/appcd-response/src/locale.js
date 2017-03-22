import { spawnSync } from 'child_process';

let cachedLocale;

/**
 * Determines the current locale of this machine.
 *
 * @returns {String}
 */
export function locale() {
	if (cachedLocale !== undefined) {
		return cachedLocale;
	}

	if (process.platform == 'win32') {
		let { stdout } = spawnSync('reg', ['query', 'HKCU\\Control Panel\\International', '/v', 'Locale']);
		let m = stdout.toString().trim().match(/Locale\s+REG_SZ\s+(.+)/);
		if (m) {
			m = m[1].substring(m[1].length - 4, m[1].length);
			let { stdout } = spawnSync('reg', ['query', 'HKLM\\SOFTWARE\\Classes\\MIME\\Database\\Rfc1766', '/v', m]);
			m = stdout.toString().trim().match(/REG_SZ\s+([^;,\n]+?);/);
			cachedLocale = m ? m[1].replace(/_/g, '-') : null;
		}
	} else {
		let m = spawnSync('locale').stdout.toString().match(/^LANG="?([^".\s]+)/);
		cachedLocale = m ? m[1].replace(/_/g, '-') : null;
	}

	return cachedLocale;
}
