# ![Appc Daemon logo](images/appc-daemon.png) Daemon Project

## Commandments

### Must be invisible to users

Users should not need to worry about starting the Appc Daemon. Clients such as the Appc CLI or Axway
Appcelerator Studio will be responsible for ensuring that the Appc Daemon is running.

### Must not require root privileges

The Appc Daemon must be able to run as an unprivileged user. The Appc Daemon and its plugins are not
permitted to listen on privileged ports or write to system files.

### Must be crashable

The Appc Daemon and its plugins must be able to tolerate a crash or the process being killed. Any
data that is important must be persisted to disk immediately.

### Must be extensible

All specific logic must be implemented in a plugin. Each plugin must be isolated and properly handle
unresolved services.

### Must have a decoupled architecture

All Appc Daemon services must be loosely coupled. Services can depend on other services, but
gracefully handle when those dependencies are unavailable and allow those dependencies to be
upgraded.

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

### Must be written using best practices

The Appc Daemon code must be written using best practices including latest ECMAScript standards,
unit tests, linted coding style, and inline ESDoc API docs. The code should use as few NPM
dependencies as possible, be as small and memory efficient as possible, and follow best security
practices.
