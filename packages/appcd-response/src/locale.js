import { run } from 'appcd-subprocess';
import { get } from 'appcd-winreg';

let cachedLocale;

/**
 * Determines the current locale of this machine.
 * @async
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
		const { stdout } = await run('locale');
		const m = stdout.toString().match(/^LANG="?([^".\s]+)/);
		cachedLocale = m ? m[1].replace(/_/g, '-') : null;
	}

	return cachedLocale;
}
