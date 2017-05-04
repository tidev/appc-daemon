import { codes, createErrorClass } from 'appcd-response';

const PluginError = createErrorClass('PluginError', {
	defaultStatus: codes.BAD_REQUEST,
	defaultCode: codes.PLUGIN_BAD_REQUEST
});

export default PluginError;
