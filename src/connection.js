/**
 * Connection object to pass through the dispatcher.
 */
export default class Connection {
	/**
     * Creates the connection object.
     *
	 * @param {Object} opts
	 * @param {WebSocket} opts.socket
	 * @param {String} opts.id
	 * @param {Object} opts.data
     */
	constructor(opts) {
		this.socket = opts.socket;
		this.id = opts.id;
		this.data = opts.data;
	}

	/**
	 * Add listener for additional messages from the client.
	 *
	 * @param {String} path
	 * @param {Function} fn
	 * @access public
	 */
	on(path, fn) {
		//
	}

	/**
	 * Sends a response to the client.
	 *
	 * @param {Number} status=200
	 * @param {*} response
	 * @returns {Promise}
	 * @access public
	 */
	send(status, response) {
		return new Promise((resolve, reject) => {
			const res = {
				status: status || 200,
				id: this.id,
				data: response
			};
			this.socket.send(JSON.stringify(res));
			resolve(res);
		});
	}
}
