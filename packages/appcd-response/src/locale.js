import { run } from 'appcd-subprocess';
import { get } from 'appcd-winreg';

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
			let locale = await get('HKLM', 'SOFTWARE\\Classes\\MIME\\Database\\Rfc1766', value);
			let m = locale.match(/([^;,\n]+?);/);
			cachedLocale = m ? m[1].replace(/_/g, '-') : null;
		}
	} else {
		let { stdout } = await run('locale');
		let m = stdout.toString().match(/^LANG="?([^".\s]+)/);
		cachedLocale = m ? m[1].replace(/_/g, '-') : null;
	}

	return cachedLocale;
}
