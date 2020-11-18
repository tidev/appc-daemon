> [Home](../../../README.md) ➤ [Development](../../README.md) ➤ [Appc Daemon Development](../README.md) ➤ [Architecture](README.md) ➤ Telemetry

> :warning: Under construction.

# Telemetry

The telemetry system is implemented in the `appcd-telemetry` pacakge and provides a service for
collecting time and counter-based information and sending it to the Appc cloud for processing.

All telemetry payloads are persisted to disk and sent to the cloud in batches.

### Data

The data that is captured includes:

* Startup time
* Hardware information:
  * Total memory
  * Number of cores
  * Appc Daemon install path
* Software information:
  * Operating system and architecture
  * Node.js
  * npm
  * Yarn
* Registered plugins and load time

Plugin-specific data:

* Logged in status
  * Organization
* System info
  * Xcode
  * iOS SDKs
  * Android SDKs/NDKs
  * JDKs

### Future Telemetry

* Appc Daemon crashes
* Health
  * Memory usage, CPU usage, uptime
  * Plugin memory usage, CPU usage, uptime
  * Subprocess stats
  * Filesystem watcher stats
  * Client request stats (Appc CLI, Appcd CLI, HTTP, WebSocket, Appc Studio, `appcd-client`, etc)
  * Online vs offline time
