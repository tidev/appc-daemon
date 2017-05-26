# ![Appc Daemon logo](../../images/appc-daemon.png) Daemon Project

## Telemetry

The telemetry system is implemented in the `appcd-telemetry` pacakge and provides a service for
collecting time and counter-based information and sending it to the Appc cloud for processing.

All telemetry payloads are persisted to disk and sent to the cloud in batches.

### Data

The data that is captured includes:

* Startup time
* Memory usage, CPU usage, uptime
* Online vs offline time
* Logged in status
* Hardware information:
	* Total memory
	* Number of cores
	* Number of drives
	* Root drive the Appc Daemon is installed
	* Root drive the workspace is located
* Software information:
	* Operating system and architecture
	* Node.js
	* npm
	* Yarn
	* Xcode
	* iOS SDKs
	* Android SDKs/NDKs
	* JDKs
* Client request stats (Appc CLI, Appcd CLI, HTTP, WebSocket, Appc Studio, `appcd-client`, etc)
* Commands being run, runtime, and errors
* Registered plugins, memory usage, CPU usage, uptime, load time
* Subprocess stats
* Filesystem watcher stats

If possible, it would be also nice to know:

* Is the machine virtualized?
* Is the storage drive a HDD or SSD?
* Appc Daemon crashes
