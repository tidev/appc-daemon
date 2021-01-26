# v1.0.3 (Jan 26, 2021)

 * chore: Updated dependencies.

# v1.0.2 (Jan 22, 2021)

 * chore: Updated dependencies.

# v1.0.1 (Jan 5, 2021)

 * chore: Updated dependencies.

# v1.0.0 (Dec 1, 2020)

 * Initial release with `SubprocessManager` migrated from `appcd-subprocess`.
 * feat: Moved subprocess status to top-level route with subscription support.
 * fix: Properly handle IPC send errors when child process goes away.
 * fix: Kill non-detached child processes when response stream is closed by the caller.
 * fix: Decouple subprocess data from `/appcd/status`.
 * fix: Hide child process event emitter so that it won't leak when subprocess info is stringified.
