import { codes, createErrorClass } from 'appcd-response';

const PluginError = createErrorClass('PluginError', {
	defaultStatus:     codes.BAD_REQUEST,
	defaultStatusCode: codes.PLUGIN_BAD_REQUEST
});

export default PluginError;

/**
 * A specific error that we use to reduce noise in the logs when a module directory isn't an Appc
 * Daemon plugin.
 */
export class PluginMissingAppcdError extends PluginError {
}
