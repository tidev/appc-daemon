> [Home](README.md) ➤ Introduction

# Introduction

## Overview

The Appc Daemon is a server that runs on a developer's computer and hosts services which power the
tooling for Axway products such as Axway Titanium SDK.

Traditionally each product has had it's own tooling such as command line tools. These tools are
usually built and maintained by separate teams with little code sharing, inconsistent user
experiences, poorly documented code, no standardized 3rd party packages, and insufficient unit
tests.

The Appc Daemon aims to solve all these issues by introducing a robust, flexible, and consistent
foundation for implementing product tooling. It does this through a plugin architecture that
exposes services over HTTP using any HTTP client, a WebSocket, or the appcd Node.js client.

It is designed to be highly decoupled. All product-specific logic is run inside a plugin. The Appc
Daemon provides core functionality to plugins such as file system watching and spawning
subprocesses.

## Background

The idea for the Appc Daemon originated in Fall 2013 as a means to speed up Titanium SDK build
times by caching system information.

It turns out there are several uses and benefits of having a background daemon:

 * Persist state that does not or rarely changes between commands
 * Support event driven actions such as devices being connected or disconnected
 * Significantly reduce build times and boost the speed of developer workflow
 * Improved hot reloading (aka LiveView) and debugging apps
 * Manage platform session state
 * Enforce platform authentication and entitlements
 * Improve the testability of our tooling code
 * Support for product silo specific CLIs (i.e. cloud, client)
 * Support for clients beyond of the Titanium CLI for various IDEs and tools
 * Provide a debug proxy for debugging Titanium apps
 * Serve a web-based UI for managing, developing, and debugging apps
 * Background deploy apps to the cloud
 * Periodically check for updates

By consolidating all of our existing toolchain components into the Appc Daemon architecture, we:

 * Reduce the number of products
 * Reduce code maintenance
 * Reduce dependency management
 * Reduce test surface area
 * Maximize code reuse
 * Provide consistent user experience

## Commandments

The following are the architecture rules for which the Appc Daemon adheres to.

### 1. Must be invisible to users

Users should not need to worry about starting the Appc Daemon. Clients such as the Titanium CLI or
Axway Appcelerator Studio will be responsible for ensuring that the Appc Daemon is running.

### 2. Must not require root privileges

The Appc Daemon must run as an unprivileged user. The Appc Daemon and its plugins are not permitted
to listen on privileged ports or write to system files. All caches, config files, and temporary
files must be written to a user-writable directory.

### 3. Must be crashable

The Appc Daemon and its plugins must be able to tolerate a crash or the process being killed. Any
data that is important must be persisted to disk immediately.

### 4. Must be extensible

All specific logic must be implemented in a plugin. Each plugin must be isolated and properly handle
unresolved services.

### 5. Must have a decoupled architecture

All Appc Daemon services must be loosely coupled. Services can depend on other services, but
gracefully handle when those dependencies are unavailable and allow those dependencies to be
upgraded.

### 6. Must work on all platforms

The Appc Daemon must reliably work on macOS, Linux, and Windows. There shouldn't be any platform
specific features.

### 7. Must work offline

There are going to be scenarios where the computer running the Appc Daemon without Internet
connectivity and the Appc Daemon's core system must be able to function and plugins must be able to
gracefully handle offline state.

### 8. Must provide Axway Platform integration

It is critical that the daemon handle Axway AMPLIFY Platform authentication and entitlements. Many
of the Appc Daemon plugins will depend on the cloud for one thing or another. The Appc Daemon
plugins that require Appc Platform features should tolerate being offline.

### 9. Must enforce entitlements

Entitlements are based on your Axway AMPLIFY Platform authorization and must enforced. The Appc
Daemon is intended to be free, however there may be plugins or features that require an
entitlement.

### 10. Must be free

Axway Titanium SDK is open source and currently relies on the open source Titanium CLI to create and
build Titanium apps. Since the Appc CLI is being replaced with a Titanium CLI that depends on the
Appc Daemon, it is critical for the Titanium SDK that the Appc Daemon must be free. With
entitlements we can lockdown features that the open source users do not have access to.

### 11. Must provide telemetry

As users create apps, there is a great deal of data that we would be most interested in analyzing.
The basics include hardware configurations and platform usage. However it would be great to get
crash reports, build times, code metrics, API usage, plugin information, and so on.

### 12. Must be able to lock down Node.js and dependency's versions

To reduce the amount of testing and assure quality, the Appc Daemon core and its plugins must run
using a specific version of Node.js. This affects not only the JavaScript features that are
usable, but the transpiliation targets and npm dependencies including Node.js native C++ addons.

### 13. Must be written using best practices

The Appc Daemon code must be written using best practices including latest ECMAScript standards,
unit tests, linted coding style, and inline ESDoc API docs. The code should use as few npm
dependencies as possible, be as small and memory efficient as possible, and follow best security
practices.
