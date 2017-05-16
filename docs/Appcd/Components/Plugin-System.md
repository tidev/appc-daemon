# ![Appc Daemon logo](../..images/appc-daemon.png) Daemon Project

## Plugin System

All service logic, such as the Appc CLI and Titanium, belongs in a plugin. Appcd plugins are either
loaded internally or externally. Internal plugins are loaded in the same process as the daemon core
and cannot be unloaded. External plugins run in a plugin host subprocess and can be unloaded or
reloaded, but have limited plugin hook capabilities.
