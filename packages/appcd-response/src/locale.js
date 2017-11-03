import { get } from 'appcd-winreg';
import { spawnSync } from 'child_process';

let cachedLocale;

/**
 * Determines the current locale of this machine.
 *
 * @returns {Promise<String>}
 */
export async function locale() {
	if (cachedLocale !== undefined) {
		return cachedLocale;
	}

	if (process.platform === 'win32') {
		let value = await get('HKCU', 'Control Panel\\International', 'Locale');
		if (value) {
			value = value.substring(value.length - 4, value.length);
			const locale = await get('HKLM', 'SOFTWARE\\Classes\\MIME\\Database\\Rfc1766', value);
			const m = locale.match(/([^;,\n]+?);/);
			cachedLocale = m ? m[1].replace(/_/g, '-') : null;
		}
	} else {
		let m = spawnSync('locale').stdout.toString().match(/^LANG="?([^".\s]+)/);
		cachedLocale = m ? m[1].replace(/_/g, '-') : null;
	}

	return cachedLocale;
}
