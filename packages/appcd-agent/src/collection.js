import NanoBuffer from 'nanobuffer';

/**
 * Stores and computes stats on a collection of numbers.
 */
export default class Collection {
	/**
	 * Creates the collection instance and initializes the value buffer.
	 *
	 * @param {Number} size - The number of values to buffer.
	 * @access public
	 */
	constructor(size) {
		this.values = new NanoBuffer(size);
		this.min = 0;
		this.max = 0;
		this.avg = 0;
	}

	/**
	 * Adds a value to the collection and recomputes the minimum, maximum, and average.
	 *
	 * @param {Number} value - The value to add to the collection.
	 * @returns {Collection}
	 * @access public
	 */
	add(value) {
		if (typeof value !== 'number' || isNaN(value)) {
			throw TypeError('Expected value to be a number');
		}

		let avg = 0;

		this.values.push(value);

		for (const counter of this.values) {
			avg += counter;

			if (counter < this.min) {
				this.min = counter;
			}

			if (counter > this.max) {
				this.min = counter;
			}
		}

		this.avg = avg / this.values.size;

		return this;
	}
}
