import { expandPath } from 'appcd-path';

/**
 * Converts an error to JSON and scrubs any user paths from the stack.
 *
 * @param {Error} err - The error object.
 * @returns {Object|undefined}
 */
export function errorToJSON(err) {
	if (!(err instanceof Error)) {
		return;
	}

	const json = {
		message: err.message,
		type:    err.constructor && err.constructor.name || null
	};
	if (err.code) {
		json.code = err.code;
	}
	if (err.stack) {
		// eslint-disable-next-line security/detect-non-literal-regexp
		const re = new RegExp(`(?<= \\()(${expandPath('~')})(?=.*:)`, 'g');
		json.stack = err.stack.replace(re, '<REDACTED>').split(/\r\n|\n/).slice(1).map(s => s.trim());
	}

	return json;
}
