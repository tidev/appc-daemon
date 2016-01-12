/**
 * Connection object to pass through the dispatcher.
 */
export default class Connection {
	/**
	 * Creates the connection object.
	 * @param {Object} opts
	 */
	constructor(opts={}) {
		this.socket = opts.socket;
		this.id = opts.id;
		this.data = opts.data || {};
	}

	/**
	 * Listens for additional messages from the client.
	 */
	on(path, fn) {
	}

	/**
	 * Sends a response to the client.
	 *
	 * @param {*} data
	 * @returns {Promise}
	 */
	send(data) {
		return new Promise((resolve, reject) => {
			this.socket.send(JSON.stringify({
				status: 200,
				id: this.id,
				data: data
			}));
			resolve();
		});
	}
}
