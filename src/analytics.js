import autobind from 'autobind-decorator';
import { existsSync, expandPath } from './util';
import mkdirp from 'mkdirp';

export default class Analytics {
	constructor(opts = {}) {
		this.enabled   = !!opts.enabled;
		this.eventsDir = expandPath(opts.eventsDir);
		this.url       = opts.url;

		if (!this.enabled) {
			return;
		}

		mkdirp.sync(this.eventsDir);
	}

	/**
	 * ?
	 */
	@autobind
	newEvent(data) {
		// TODO: inject common data
		appcd.logger.log('got analytics event!');
		appcd.logger.log(data);
	}
}
