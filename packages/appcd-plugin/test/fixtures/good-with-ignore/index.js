const fs = require('fs');
const path = require('path');
console.log('good external plugin required');
let counter = 0;

module.exports = {
	activate() {
		appcd.register('/counter', ctx => {
			counter++;
			ctx.response = counter;
			fs.writeFileSync('./counter.txt', counter.toString());
		});
	},

	deactivate() {
		console.log('hi from deactivate!');
	}
};
