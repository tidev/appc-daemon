/* eslint security/detect-child-process: 0, security/detect-non-literal-regexp: 0 */

import { spawnSync } from 'child_process';

/**
 * The cached locale value.
 *
 * @type {?String}
 */
let cachedLocale;

/**
 * Determines the current locale of this machine.
 *
 * @param {Boolean} [force=false] - When `true`, it will bypass the cached locale and redetect.
 * @returns {Promise<String>} Resolves the locale or `null` if a locale cannot be determined.
 */
export async function locale(force) {
	if (!force && cachedLocale !== undefined) {
		return cachedLocale;
	}

	cachedLocale = null;

	try {
		if (process.platform === 'win32') {
			let r = spawnSync('reg', [ 'query', 'HKCU\\Control Panel\\International', '/v', 'Locale' ]);
			let m = !r.status && r.stdout.toString().trim().match(/Locale\s+\w+\s+(\d+)/);
			if (m) {
				const code = m[1].substr(-4);
				r = spawnSync('reg', [ 'query', 'HKLM\\SOFTWARE\\Classes\\MIME\\Database\\Rfc1766', '/v', code ]);
				m = !r.status && r.stdout.toString().trim().match(new RegExp(`${code}\\s+\\w+\\s+([^;,\n]+)`));
				cachedLocale = m ? m[1] : null;
			}
		} else {
			const m = spawnSync('locale').stdout.toString().match(/^LANG="?([^".\s]+)/);
			cachedLocale = m ? m[1].replace(/_/g, '-') : null;
		}
	} catch (e) {
		// this can happen if the 'locale' command is not found in the system path
	}

	return cachedLocale;
}
