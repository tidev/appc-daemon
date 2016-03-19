import autobind from 'autobind-decorator';
import { existsSync, absolutePath } from './util';
import mkdirp from 'mkdirp';

export default class Analytics {
	constructor(opts = {}) {
		this.enabled   = !!opts.enabled;
		this.eventsDir = absolutePath(opts.eventsDir);
		this.url       = opts.url;

		if (!this.enabled) {
			return;
		}

		if (!existsSync(this.eventsDir)) {
			mkdirp.sync(this.eventsDir);
		}
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
