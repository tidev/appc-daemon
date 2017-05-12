# ![Appc Daemon logo](images/appc-daemon.png) Daemon Project

## Rationale

The idea for the Appc Daemon originated in Fall 2013 by [Chris Barber](mailto:cbarber@axway.com) as
a means to speed up Titanium SDK build times by caching system information.

It turns out there are several uses and benefits of having a background daemon:

* Persist state that does not or rarely changes between commands
* Support event driven actions such as devices being connected or disconnected
* Significantly reduce build times and boost the speed of developer workflow
* Improved hot reloading (aka LiveView) and debugging apps
* Manage Appc platform session state
* Enforce Appc platform authentication and entitlements
* Improve the testability of our tooling code
* Support for product silo specific CLIs (i.e. cloud, client)
* Support for clients beyond of the Appc CLI and Appcelerator Studio
* Provide a debug proxy for debugging Titanium apps
* Serve a web-based UI for managing, developing, and debugging apps
* Automatically run Arrow apps
* Background deploy Arrow apps to the cloud
* Periodically check for updates

By consolidating all of our existing toolchain components into the Appc Daemon architecture, we:

* Reduce the number of products
* Reduce code maintenance
* Reduce dependency management
* Reduce test surface area
* Maximize code reuse
* Provide consistent user experience

The following products will be replaced:

| Product | Action |
| ------- | ------ |
| Titanium CLI | Completely deprecated. |
| Appc CLI | Split into the client CLI and Appc Daemon plugin. The client CLI loads the config and dispatches a request to the daemon, then displays the result. The plugin fulfills the Appc CLI request whether it be creating a project, changing the configuration, or building a project. |
| Titanium SDK Build | This will become a streamlined, platform independent pipeline that automatically manages the state of the builds and exposes hooks for platform specific logic to be performed. |
| Alloy | This will become apart of the Titanium SDK build. |
| LiveView | This will become apart of the Titanium SDK build. |
| Hyperloop  | This will become apart of the Titanium SDK build. |
| Appc/Titanium Verify | This will be baked into the Appc Platform entitlements framework. |

This will result in the following Git repositories being archived:

* https://github.com/appcelerator/alloy
* https://github.com/appcelerator/appc.js
* https://github.com/appcelerator/appc-cli
* https://github.com/appcelerator/appc-cli-android
* https://github.com/appcelerator/appc-cli-core
* https://github.com/appcelerator/appc-cli-expressjs
* https://github.com/appcelerator/appc-cli-ios
* https://github.com/appcelerator/appc-cli-mbaas
* https://github.com/appcelerator/appc-cli-titanium
* https://github.com/appcelerator/appc-install
* https://github.com/appcelerator/appc-platform-sdk
* https://github.com/appcelerator/appc-verify
* https://github.com/appcelerator/hyperloop-cli-plugin
* https://github.com/appcelerator/liveview
* https://github.com/appcelerator/titanium
* https://github.com/appcelerator/titanium_verify
