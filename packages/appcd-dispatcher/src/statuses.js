/**
 * A map of codes and their values.
 * @type {Object}
 */
export const codes = {
	OK:                 200,

	SUBSCRIBED:         250,
	ALREADY_SUBSCRIBED: 251,
	NOT_SUBSCRIBED:     252,
	UNSUBSCRIBED:       253,

	BAD_REQUEST:        400,
	NO_ROUTE:           404,

	SERVER_ERROR:       500
};

/**
 * A map of status codes and their descriptions.
 * @type {Object}
 */
export const statuses = {
	[codes.OK]:                 'OK',
	[codes.SUBSCRIBED]:         'Subscribed',
	[codes.ALREADY_SUBSCRIBED]: 'Already subscribed',
	[codes.NOT_SUBSCRIBED]:     'Not subscribed',
	[codes.UNSUBSCRIBED]:       'Unsubscribed',

	[codes.BAD_REQUEST]:        'Bad request',
	[codes.NO_ROUTE]:           'No route',

	[codes.SERVER_ERROR]:       'Server error'
};
