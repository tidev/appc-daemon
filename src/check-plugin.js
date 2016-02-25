import './server';
import Service from './service';

process.on('uncaughtException', err => {
	console.error(err.toString());
	process.exit(1);
});

const mainFile = process.argv[2];

if (!mainFile) {
	console.error('No main file specified');
	process.exit(2);
}

const module = require(mainFile);
const ServiceClass = module && module.__esModule ? module.default : module;

if (!ServiceClass || typeof ServiceClass !== 'function' || !(ServiceClass.prototype instanceof Service)) {
	console.log('Plugin does not export a service');
	process.exit(3);
}

// we found a valid plugin!
process.exit(0);
