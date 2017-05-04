const someage = 21;

module.exports = {
	/**
	 * Everybody has a name.
	 * @type {String}
	 */
	name: 'foo',

	/**
	 * How old are you?
	 * @type {Number}
	 * @deprecated Age ain't nothing but a number
	 */
	age: someage,

	/**
	 * A unique id.
	 * @type {String}
	 * @readonly
	 */
	id: '123456',

	arrays: {
		/**
		 * A simple array with no datatype.
		 * @type {Array}
		 */
		simple: ['pizza', 'tacos'],

		/**
		 * Array of numbers
		 * @type {Array<Number>}
		 */
		arrayNums: [1, 2, 3],

		/**
		 * Another array of numbers.
		 * @type {Array.<Number>}
		 */
		arrayNums2: [4, 5, 6],

		/**
		 * Yet another array of numbers.
		 * @type {Number[]}
		 */
		arrayNums3: [7, 8, 9],

		/**
		 * Array of numbers or strings.
		 * @type {Array<number|string>}
		 */
		multi: ['a', 1]
	},

	/**
	 * Multiple types.
	 * @type {number|string}
	 */
	multi: null,

	/**
	 * Could be null.
	 * @type {?number}
	 */
	couldBeNull: null,

	/**
	 * Could be null.
	 * @type {number|null}
	 */
	couldBeNull2: null,

	/**
	 * Cannot be null.
	 * @type {!number}
	 */
	cantBeNull: 0,

	/**
	 * Could be undefined.
	 * @type {number|undefined}
	 */
	couldBeUndef: undefined,

	job: {
		/**
		 * Job title.
		 * @type {String}
		 */
		title: 'coder'
	},

	/**
	 * @type {String}
	 */
	noDesc: 'nada'
};
