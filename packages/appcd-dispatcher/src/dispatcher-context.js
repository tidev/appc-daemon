/**
 * A context that contains request information and is routed through the dispatcher.
 */
export default class DispatcherContext {
	/**
	 * Mixes the context parameters into this instance.
	 *
	 * @param {Object} params - Various context-specific parameters.
	 */
	constructor(params) {
		Object.assign(this, params);
	}
}
