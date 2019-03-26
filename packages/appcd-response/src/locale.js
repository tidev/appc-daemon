import { get } from 'appcd-winreg';
import { spawnSync } from 'child_process';

let cachedLocale;

/**
 * Determines the current locale of this machine.
 *
 * @param {Boolean} [force=false] - When `true`, it will bypass the cached locale and redetect.
 * @returns {Promise<String>}
 */
export async function locale(force) {
	if (!force && cachedLocale !== undefined) {
		return cachedLocale;
	}

	try {
		if (process.platform === 'win32') {
			let value = await get('HKCU', 'Control Panel\\International', 'Locale');
			if (value) {
				value = value.substring(value.length - 4, value.length);
				const locale = await get('HKLM', 'SOFTWARE\\Classes\\MIME\\Database\\Rfc1766', value);
				const m = locale.match(/([^;,\n]+?);/);
				cachedLocale = m ? m[1].replace(/_/g, '-') : null;
			}
		} else {
			const output = spawnSync('locale').stdout.toString();
			console.log('OUTPUT');
			console.log(output);
			const m = output.match(/^LANG="?([^".\s]+)/);
			console.log(m);
			cachedLocale = m ? m[1].replace(/_/g, '-') : null;
		}
	} catch (e) {
		// this can happen if the 'locale' command is not found in the system path
		cachedLocale = null;
	}

	return cachedLocale;
}
