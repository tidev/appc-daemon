if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

export {
	default,
	default as loadMessage
} from './message';

export * from './codes';
