# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## Subprocess Manager

The Subprocess Manager spawns and monitors child processes. It is implemented as a service in the
`appcd-subprocess` package.

Only WebSocket-based clients can spawn subprocesses.

The [Plugin System](../Components/Plugin-System) makes extensive use of the Subprocess Manager for
spawning external plugins.

The Subprocess Manager provides service endpoints for spawning a process, spawning a Node.js
process, and killing a subprocess.

Refer to the [/appcd/subprocess](../Services/subprocess.md) service for more information.
