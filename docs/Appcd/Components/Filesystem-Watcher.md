# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## Filesystem Watcher

Filesystem watching is expensive and inconsistent between platforms. In an effort to consolidate
watch resources, the Filesystem Watcher exposes a service that allows plugins to watch directories
or files for changes. It is implemented in the `appcd-fswatcher` pacakge.

The filesystem watcher works by keeping a tree per root drive in memory of the watched directories
and files. Tree nodes represent directories, files, symlinks, and non-existent files. This allows it
to watch for files that do not exist yet. Each node also tracks a list of watchers so that multiple
sources can watch the same directory while using a single Node.js FSWatch instance.

Node.js only supports recursive filesystem watching on Windows and macOS, however Linux doesn't. The
filesystem watcher supports recursive watching on all platforms by descending into each child
directory and adding it to the tree. This is very expensive for large and deep directories and
should be avoided if possible.

Refer to the [/appcd/fs/watch](../Services/fs.md) service for more information.
