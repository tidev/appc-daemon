import autobind from 'autobind-decorator';
import { HookEmitter } from 'hook-emitter';

/**
 * Connection object to pass through the dispatcher.
 *
 * @extends {EventEmitter}
 */
export default class Connection extends HookEmitter {
	/**
     * Creates the connection object.
     *
	 * @param {Object} opts
	 * @param {WebSocket} opts.socket
	 * @param {String} opts.id
     */
	constructor({ socket, id }) {
		super();

		if (!socket || typeof socket !== 'object' || typeof socket.send !== 'function' || typeof socket.close !== 'function') {
			throw new TypeError('Invalid socket');
		}

		if (!id || typeof id !== 'string') {
			throw new TypeError('Invalid id');
		}

		/**
		 * The connection's WebSocket.
		 * @type {WebSocket}
		 */
		this.socket = socket;

		socket.on('close', () => this.emit('close'));
		socket.on('error', err => this.emit('error', err));

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
	 * Sends a response, then closes the connection.
	 *
	 * @param {*} [data] - The response payload to send.
	 * @access public
	 */
	end(data) {
		if (data) {
			return this.send(data)
				.then(() => this.close());
		}

		this.close();
	}

	/**
	 * Ends the request.
	 *
	 * @access public
	 */
	@autobind
	close() {
		// TODO: do NOT close the socket, rather send the end request message
		this.socket.close();
	}
}
