import CLI from 'cli-kit';

//config "userAgent": `Node script: ${process.mainModule.filename}`

export default class Server {
	constructor() {
		// load config
		// init log
	}

	run(argv) {
		return new CLI({
			commands: {
				start: this.start.bind(this),
				stop: this.stop.bind(this)
			}
		}).exec(argv);
	}

	start() {
		console.log('STARTING CORE!');
		//  - init home
		//  - check if running
		//  - init config handler
		//  - init machine id
		//  - init analytics
		//  - load in-process and plugins
		//     - status monitor
		//     - handlers
		//     - web server
	}

	stop() {
		console.log('STOPPING CORE!');
	}
}
