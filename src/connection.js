import { EventEmitter } from 'events';

/**
 * Connection object to pass through the dispatcher.
 */
export default class Connection extends EventEmitter {
	/**
     * Creates the connection object.
     *
	 * @param {Object} opts
	 * @param {WebSocket} opts.socket
	 * @param {String} opts.id
	 * @param {Object} opts.data
     */
	constructor({ socket, id, data }) {
		super();
		this.socket = socket;
		this.id = id;
		this.data = data;
	}

	/**
	 * Writes data to the socket. This is useful for piping streams.
	 *
	 * @param {*} data
	 * @returns {Boolean}
	 * @access public
	 */
	write(data) {
		this.send(200, data);
		return true;
	}

	/**
	 * Sends a response to the client.
	 *
	 * @param {Number} status=200
	 * @param {*} data
	 * @returns {Promise}
	 * @access public
	 */
	send(status, data) {
		return new Promise((resolve, reject) => {
			const res = {
				status: status || 200,
				id: this.id,
				data: data instanceof Buffer ? data.toString() : data
			};

			this.socket.send(JSON.stringify(res));
			resolve(res);
		});
	}
}
