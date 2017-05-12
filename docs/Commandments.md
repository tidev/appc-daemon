# ![Appc Daemon logo](images/appc-daemon.png) Daemon Project

## Commandments

### Must be invisible to users

Users will not need to worry about starting the Appc Daemon. Clients such as the Appc CLI or Axway
Appcelerator Studio will be responsible for ensuring that the Appc Daemon is running.

### Must not require root privileges

The Appc Daemon must be able to run as an unprivileged user. The Appc Daemon, nor any of its
plugins, are allowed to listen on privileged ports or write to system files.

### Must be crashable

The Appc Daemon and its plugins must be able to tolerate a crash or the process being killed. Any
data that is important must be persisted to disk immediately.

### Must be extensible

All specific logic must be implemented in a plugin. There must be a strict plugin lifecycle policy
and treat every plugin equally.

### Must have a decoupled architecture

The Appc Daemon must allow a decoupled architecture that allows plugins to communicate with each
other.

### Must include a CLI for controlling the Appc Daemon

An "appcd" CLI will be used to start, stop, and query the status of the Appc Daemon.

### Must work on all platforms

The Appc Daemon must reliably work on macOS, Linux, and Windows. There shouldn't be any platform
specific features.

### Must work offline

There are going to be scenarios where the computer running the Appc Daemon without Internet
connectivity and the Appc Daemon's core system must be able to function and plugins must be able to
gracefully handle offline state.

### Must provide Appc Platform integration

It is critical that the daemon handle Appc Platform authentication and entitlements. Many of the
Appc Daemon plugins will depend on the cloud for one thing or another. The Appc Daemon plugins that
require Appc Platform features should tolerate being offline.

### Must enforce entitlements

Entitlements are based on your Appc Platform authorization and must enforced. The Appc Daemon is
intended to be free, though not necessarily open source, however there may be plugins or features
that require an entitlement.

### Must be free

Axway Titanium SDK is open source and currently relies on the open source Titanium CLI to create and
build Titanium apps. Since the Titanium CLI is going away, Titanium SDK will require a free
alternative and thus the Appc Daemon must be free. With entitlements we can lockdown features that
the open source users do not have access to.

### Must provide telemetry

As users create apps, there is a great deal of data that we would be most interested in analyzing.
The basics include hardware configurations and platform usage. However it would be great to get
crash reports, build times, code metrics, API usage, plugin information, and so on.

### Must be able to lock down Node.js and dependency's versions

To reduce the amount of testing and improve the quality, the Appc Daemon core and its plugins must
be able to lockdown the Node.js version so that we can lockdown any Node.js native addons and NPM
dependencies. Node.js native addons are generally compiled for the given Node.js version, platform,
and CPU architecture during installation. This requires a compiler to be present. Since the Appc
Daemon's Node.js version is locked down, we can pre-compile these native addons, speed up installs,
and eliminate the need for a compiler on end user machines.
