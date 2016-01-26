import autobind from 'autobind-decorator';
import { EventEmitter } from 'events';

/**
 * Connection object to pass through the dispatcher.
 *
 * @extends {EventEmitter}
 */
export default class Connection extends EventEmitter {
	/**
     * Creates the connection object.
     *
	 * @param {Object} opts
	 * @param {WebSocket} opts.socket
	 * @param {String} opts.id
     */
	constructor({ socket, id }) {
		super();

		/**
		 * The connection's WebSocket.
		 * @type {WebSocket}
		 */
		this.socket = socket;

		/**
		 * The request id.
		 * @type {String}
		 */
		this.id = id;
	}

	/**
	 * Writes data to the socket. This is useful for piping streams.
	 *
	 * @param {Object} data
	 * @returns {Boolean}
	 * @access public
	 */
	write(data) {
		this.send(data);
		return true;
	}

	/**
	 * Sends a response to the client.
	 *
	 * @param {*} data - The response payload to send. Must not be cyclic.
	 * @param {Number} [status=200] - The response status code.
	 * @returns {Promise}
	 * @access public
	 */
	send(data, status) {
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

	/**
	 * Ends the request.
	 *
	 * @access public
	 */
	@autobind
	close() {
		this.socket.close();
	}
}
