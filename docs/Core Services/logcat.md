> [Home](../README.md) ➤ [Core Services](README.md) ➤ Logcat Service

# Logcat Service

A continuous stream of appcd debug log messages.

## `/appcd/logcat`

Immediately returns the past 1,000 debug log messages, then continues to stream any new messages.

It is the caller's responsibility to perform any log message filtering.

### Example

```
$ appcd exec /appcd/logcat
```

#### Response

The response is a series of log objects. The `"message"` contains ANSI escape codes with color
information. These codes can be stripped out before writing to a file.

The `"ns"` property is the log message namespace and is used for filtering.

```json
{
  "message": "\u001b[35m2020-10-21T05:42:04.327Z\u001b[39m \u001b[38;2;112;134;51mappcd:core:status\u001b[39m CPU: \u001b[90m   0.2%\u001b[39m  Heap:\u001b[32m  ↓33.39 MB\u001b[39m /\u001b[90m   37.84 MB\u001b[39m  RSS: \u001b[31m ↑45.41 MB\u001b[39m  Uptime: \u001b[90m12h 23m 2s\u001b[39m\n",
  "ns": "appcd:core:status",
  "ts": "2020-10-21T05:42:04.327Z",
  "type": "log"
}
```
