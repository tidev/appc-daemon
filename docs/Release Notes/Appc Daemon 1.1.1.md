# Appc Daemon 1.1.1

## Apr 10, 2018

This is a patch release with bug fixes and minor dependency updates.

### Installation

```
npm i -g appcd@1.1.1
```

### appcd@1.1.1

 * fix: Changed `exec` command to return full JSON response instead of just the message.

### appcd-gulp@1.1.2

 * Fixed bug where the main entry point was still referencing `pretty-log` instead of `fancy-log`.

### appcd-response@1.1.1

 * feat: Added response code 501 Not Implemented.