# ![Appc Daemon logo](images/appc-daemon.png) Daemon Project

## Environment Variables

| Variable                  | Description                                                          |
| :------------------------ | :------------------------------------------------------------------- |
| APPCD_INSPECT_PLUGIN      | The name of the plugin to inspect when the plugin is started. This is the name derived from the `package.json`'s `appcd-plugin.name` or `name`. For example, `appcd-plugin-ios`'s plugin name is `ios`. |
| APPCD_INSPECT_PLUGIN_PORT | The port that the inspector should listen on when starting a plugin. Defaults to `9230`. If running the daemon in debug mode (`--debug`), then you will need to change the port number to something other than `9230`. Value must be greater than or equal to `1024`. |
| APPCD_INSPECT_PORT        | The port that the inspector should listen on when starting the daemon. Defaults to `9230`. Value must be greater than or equal to `1024`. |
| APPCD_LOCALE              | The preferred locale to use such as `en_US`. Defaults to the system's value. |
| APPCD_NETWORK_CA_FILE     | The path to a certificate authority file to use for all outbound HTTP requests. |
| APPCD_NETWORK_PROXY       | A URL of the proxy server to use for all outbound HTTP requests.     |
| APPCD_NETWORK_STRICT_SSL  | When `true`, enforces that remote SSL connections have valid certificates. Defaults to `true`. |
