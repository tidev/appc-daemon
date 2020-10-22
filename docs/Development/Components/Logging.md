> [Home](../../README.md) ➤ [Development](../README.md) ➤ [Components](README.md) ➤ Logging

> :warning: Under construction.

# Logging

The Appc Daemon logger buffers and streams log messages to Appc Daemon clients and stdout when
running in debug mode.

The logger will buffer the last 250 messages in memory and will flush them when a `/appcd/logcat`
request is made.

The logger is built to be verbose and flexible. All logging in the daemon itself includes ANSI color
sequences. Features such as log filtering and stripping ANSI colors is left up to the cilent.

While technically possible, the Appc Daemon currently does not persist logs to disk.

### SnoopLogg

The logger is built on top of the [SnoopLogg](https://www.npmjs.com/package/snooplogg) npm module.

Each Appc Daemon package uses a SnoopLogg logger. By default, SnoopLogg suppresses all messages, but
output can be enable for debugging purposes by setting the `SNOOPLOGG` (or `DEBUG`) environment
variable to a list of logger namespaces or `*` for everything.

The SnoopLogg instance in the `appcd-core` "snoops" on the SnoopLogg instances defined in each
`appcd-*` package and combines the log messages into a single stream.

These log messages are buffered and streamed to stdout or a service response.

SnoopLogg supports namespaced loggers and log levels as well as exposes a number of handy libraries
for pluralizing strings, applying styles, formatting numbers, and outputting symbols.
