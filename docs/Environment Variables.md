> [Home](README.md) ➤ Environment Variables

# Environment Variables

| Variable                  | Description                                                          |
| :------------------------ | :------------------------------------------------------------------- |
| APPCD_ENV                 | The name of the environment. When value is equal to `"development"`, then sensitive information in log files will NOT be redacted. |
| APPCD_HOME                | The path to the appcd home directory. |
| APPCD_INSPECT_PLUGIN      | The name of the plugin to inspect when the plugin is started. This is the name derived from the `package.json`'s `appcd-plugin.name` or `name`. For example, `appcd-plugin-ios`'s plugin name is `ios`. |
| APPCD_INSPECT_PLUGIN_PORT | The port that the inspector should listen on when starting a plugin. Defaults to `9230`. If running the daemon in debug mode (`--debug`), then you will need to change the port number to something other than `9230`. Value must be greater than or equal to `1024`. |
| APPCD_INSPECT_PORT        | The port that the inspector should listen on when starting the daemon. Defaults to `9230`. The port number must be between `1024` and `65535`. |
| APPCD_LOCALE              | The preferred locale to use such as `en_US`. Defaults to the system's value. |
| APPCD_SERVER_PORT         | The port that the appc daemon should listen on. Defaults to `1732`. The port number must be between `1024` and `65535`. |
| APPCD_TELEMETRY           | Controls the telemetry system. Set to `0` or `false` to disable telemetry. Defaults to `true`. |
| APPCD_SKIP_POSTINSTALL    | Disable the postinstall script of the main appcd package. |

## Private Environment Variables

> :warning: The following environment variables are for Appc Daemon tooling and should never by the
> user or programatically.

| Variable                  | Description                                                          |
| :------------------------ | :------------------------------------------------------------------- |
| APPCD_COVERAGE            | Signifies that coverage tests are currently being run.               |
