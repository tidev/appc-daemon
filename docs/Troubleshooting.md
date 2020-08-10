# ![Appc Daemon logo](images/appc-daemon.png) Daemon Project

## Troubleshooting

### Debug log printed to stdout when not enabled

The debug log should only be printed when `SNOOPLOGG=*` is defined or starting the daemon in debug
mode. If the debug log is being printed when it's not supposed to, then the most likely culprit is
a bug in `appcd-core`.

There are only two `snooplogg` instances that are wired up to pipe debug logs to stdout: `appcd`
and `appcd-core`.

The logger in `appcd-core` should only ever be used when starting the daemon. If `appcd` should
happen to reference a file in `appcd-core` that uses the logger, the debug log will be printed to
stdout.

In the event this should happen, `appcd-core` will need to remove debug logging from the file that
is being referenced by `appcd`.
