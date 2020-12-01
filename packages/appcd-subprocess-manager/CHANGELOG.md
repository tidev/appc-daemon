# v1.0.0

 * Initial release with `SubprocessManager` migrated from `appcd-subprocess`.
 * feat: Moved subprocess status to top-level route with subscription support.
 * fix: Properly handle IPC send errors when child process goes away.
 * fix: Kill non-detached child processes when response stream is closed by the caller.
 * fix: Decouple subprocess data from `/appcd/status`.
 * fix: Hide child process event emitter so that it won't leak when subprocess info is stringified.