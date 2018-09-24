#!/usr/bin/env node

const sleep = () => new Promise(resolve => setTimeout(resolve, 250));

(async function () {
	console.log('Hello');
	await sleep();
	console.error('Oh no!');
	await sleep();
	console.log('Just kidding');
})();
