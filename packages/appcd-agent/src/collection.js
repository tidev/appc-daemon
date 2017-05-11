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
		this.min = null;
		this.max = null;
		this.avg = null;
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

		this.values.push(value);

		if (this.values.size === 1) {
			this.min = this.max = this.avg = value;
		} else {
			let total = 0;

			for (const counter of this.values) {
				total += counter;

				if (counter < this.min) {
					this.min = counter;
				}

				if (counter > this.max) {
					this.max = counter;
				}
			}

			this.avg = total / this.values.size;
		}

		return this;
	}

	/**
	 * ?
	 *
	 * @returns {Object}
	 * @access public
	 */
	get stats() {
		return {
			values: Array.from(this.values),
			min: this.min,
			max: this.max,
			avg: this.avg
		};
	}
}
