# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## Status Monitor

The Appc Daemon's health is monitored by the Status Monitor. It tracks a number of stats and exposes
them via the [appcd status](../Commands/status.md) command and the
[/appcd/status](../Services/status.md) service. The Status Monitor uses the `appcd-agent` package
to poll process CPU and memory usage.

The internal status object is a "gawked" object which makes it observable and allows clients to
"subscribe" to status updates. This is useful if the client wishes to display a live status of the
daemon.
