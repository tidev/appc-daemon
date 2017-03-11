import { codes, statuses } from './statuses';

/**
 * A custom error for dispatcher errors.
 */
export default class DispatcherError extends Error {
	constructor(status, message) {
		if (typeof status !== 'number' && !message) {
			message = status;
			status = codes.SERVER_ERROR;
		}
		super(message);
		this.message = message || statuses[status] || 'Error';
		this.status = status;
		Error.captureStackTrace(this, this.constructor);
	}

	toString() {
		return `${this.status} - ${this.message}`;
	}
}
