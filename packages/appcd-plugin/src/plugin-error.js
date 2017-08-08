import { codes, createErrorClass } from 'appcd-response';

const PluginError = createErrorClass('PluginError', {
	defaultStatus:     codes.BAD_REQUEST,
	defaultStatusCode: codes.PLUGIN_BAD_REQUEST
});

export default PluginError;
