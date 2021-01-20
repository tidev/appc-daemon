# Appc Daemon 1.1.1

## Apr 10, 2018

This is a patch release with bug fixes and minor dependency updates.

### Installation

```
npm i -g appcd@1.1.1
```

### appcd

 * **v1.1.1** - 4/10/2018

   * fix: Changed `exec` command to return full JSON response instead of just the message.

### appcd-gulp

 * **v1.1.2** - 4/9/2018

   * Fixed bug where the main entry point was still referencing `pretty-log` instead of `fancy-log`.

### appcd-response

 * **v1.1.1** - 4/10/2018

   * feat: Added response code 501 Not Implemented.