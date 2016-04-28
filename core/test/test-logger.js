import Logger from '../dist/logger';
import { EventEmitter } from 'events';

class MockStream extends EventEmitter {
	constructor() {
		super();
		this.write = spy();
	}
}

describe('logger', () => {

	beforeEach(() => {
		Logger.reset();
	});

	afterEach(() => {
		Logger.reset();
	});

	it('should have log methods and styles', () => {
		const logger = new Logger();

		// log methods
		expect(logger).to.have.property('log');
		expect(logger).to.have.property('debug');
		expect(logger).to.have.property('info');
		expect(logger).to.have.property('warn');
		expect(logger).to.have.property('error');

		expect(logger.log).to.be.a.function;
		expect(logger.debug).to.be.a.function;
		expect(logger.info).to.be.a.function;
		expect(logger.warn).to.be.a.function;
		expect(logger.error).to.be.a.function;

		// styles
		expect(logger).to.have.property('alert');
		expect(logger).to.have.property('highlight');
		expect(logger).to.have.property('lowlight');
		expect(logger).to.have.property('note');
		expect(logger).to.have.property('notice');
		expect(logger).to.have.property('ok');

		expect(logger.alert).to.be.a.function;
		expect(logger.highlight).to.be.a.function;
		expect(logger.lowlight).to.be.a.function;
		expect(logger.note).to.be.a.function;
		expect(logger.notice).to.be.a.function;
		expect(logger.ok).to.be.a.function;

		// colors
		expect(logger).to.have.property('colors');
		expect(logger.colors).to.be.an.object;
	});

	it('should create logger without a label', () => {
		const logger = new Logger();

		expect(Logger.buffer).to.have.lengthOf(0);
		logger.log('foo');
		expect(Logger.buffer).to.have.lengthOf(1);
		logger.log('bar');
		expect(Logger.buffer).to.have.lengthOf(2);

		let line = logger.colors.strip(Logger.buffer[0]);
		line = line.substring(line.indexOf(' ') + 1);
		expect(line).to.equal('log:   foo\n');

		for (let i = 0; i < Logger.maxBuffer; i++) {
			logger.log('baz ' + i);
		}

		expect(Logger.buffer).to.have.lengthOf(Logger.maxBuffer);
	});

	it('should create a logger with a label', () => {
		const logger = new Logger('test');

		expect(Logger.buffer).to.have.lengthOf(0);
		logger.log('foo');
		expect(Logger.buffer).to.have.lengthOf(1);

		let line = logger.colors.strip(Logger.buffer[0]);
		line = line.substring(line.indexOf(' ') + 1);
		expect(line).to.equal('[test]   log:   foo\n');
	});

	it('should pipe output to a stream, then unpipe', () => {
		const logger = new Logger();
		const stream = new MockStream();

		Logger.pipe(stream, { flush: false, colors: false });
		logger.log('foo');
		Logger.unpipe(stream);
		logger.log('bar');

		expect(stream.write).to.have.been.calledOnce;
	});

	it('should flush output to a stream', () => {
		const logger = new Logger();
		const stream = new MockStream();

		logger.log('foo');
		Logger.pipe(stream, { flush: true, colors: false });
		expect(stream.write).to.have.been.calledOnce;
		Logger.unpipe(stream);
	});

	it('should pipe output to a stream with colors', () => {
		const logger = new Logger();
		const stream = new MockStream();

		Logger.pipe(stream, { flush: false, colors: true });
		logger.log('foo');
		Logger.unpipe(stream);

		expect(stream.write).to.have.been.calledOnce;
	});

	it('should unpipe when stream finishes', () => {
		const logger = new Logger();
		const stream = new MockStream();

		Logger.pipe(stream, { flush: false, colors: false });
		logger.log('foo');
		stream.emit('finish');
		logger.log('bar');

		expect(stream.write).to.have.been.calledOnce;
	});

	it('should unpipe when stream errors', () => {
		const logger = new Logger();
		const stream = new MockStream();

		Logger.pipe(stream, { flush: false, colors: false });
		logger.log('foo');
		stream.emit('error');
		logger.log('bar');

		expect(stream.write).to.have.been.calledOnce;
	});

});
