import Connection from '../dist/connection';

class MockSocket {
	constructor() {
		this.send = spy();
		this.close = spy();
	}
}

describe('connection', () => {

	describe('constructor', () => {
		it('should fail to create a new connection without socket and id', () => {
			expect(() => {
				const conn = new Connection();
			}).to.throw(TypeError);
		});

		it('should fail to create a new connection without socket', () => {
			expect(() => {
				const conn = new Connection({
					id: 'foo'
				});
			}).to.throw(TypeError);
		});

		it('should fail to create a new connection without id', () => {
			expect(() => {
				const conn = new Connection({
					socket: new MockSocket()
				});
			}).to.throw(TypeError);
		});

		it('should fail to create a new connection with bad socket', () => {
			expect(() => {
				const conn = new Connection({
					id: 'foo',
					socket: 'bar'
				});
			}).to.throw(TypeError);
		});

		it('should fail to create a new connection with empty id', () => {
			expect(() => {
				const conn = new Connection({
					id: '',
					socket: new MockSocket()
				});
			}).to.throw(TypeError);
		});

		it('should create a new connection', () => {
			const conn = new Connection({
				id: 'foo',
				socket: new MockSocket()
			});
		});
	});

	describe('write', () => {
		beforeEach(function () {
			this.socket = new MockSocket();
			this.conn = new Connection({
				id: 'foo',
				socket: this.socket
			});
		});

		afterEach(function () {
			this.socket = null;
			this.conn = null;
		});

		it('should write a string to a connection', function () {
			const data = 'bar';
			this.conn.write(data);

			expect(this.socket.send).to.have.been.calledWith(JSON.stringify({
				status: 200,
				id: 'foo',
				data
			}));
		});

		it('should write an array to a connection', function () {
			const data = ['a', 'b', 'c'];
			this.conn.write(data);

			expect(this.socket.send).to.have.been.calledWith(JSON.stringify({
				status: 200,
				id: 'foo',
				data: data
			}));
		});

		it('should write an object to a connection', function () {
			const data = {
				a: 'bar',
				b: 123,
				c: 3.14
			};
			this.conn.write(data);

			expect(this.socket.send).to.have.been.calledWith(JSON.stringify({
				status: 200,
				id: 'foo',
				data: data
			}));
		});

		it('should write a buffer to a connection', function () {
			const data = new Buffer('bar');
			this.conn.write(data);

			expect(this.socket.send).to.have.been.calledWith(JSON.stringify({
				status: 200,
				id: 'foo',
				data: data.toString()
			}));
		});
	});

	describe('send', () => {
		beforeEach(function () {
			this.socket = new MockSocket();
			this.conn = new Connection({
				id: 'foo',
				socket: this.socket
			});
		});

		afterEach(function () {
			this.socket = null;
			this.conn = null;
		});

		it('should send a 200 response to a connection', function () {
			const data = 'bar';
			this.conn.send(data, 200);

			expect(this.socket.send).to.have.been.calledWith(JSON.stringify({
				status: 200,
				id: 'foo',
				data: data
			}));
		});

		it('should send a 500 response to a connection', function () {
			const data = 'bar';
			this.conn.send(data, 500);

			expect(this.socket.send).to.have.been.calledWith(JSON.stringify({
				status: 500,
				id: 'foo',
				data: data
			}));
		});
	});

	describe('close', () => {
		it('should close a connection', () => {
			const socket = new MockSocket();

			const conn = new Connection({
				id: 'foo',
				socket
			});

			conn.close();

			expect(socket.close).to.have.been.called;
		});
	});

});
