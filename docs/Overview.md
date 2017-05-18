# ![Appc Daemon logo](images/appc-daemon.png) Daemon Project

## Overview

The Appc Daemon is a server that runs on a developer's computer and hosts services which power the
tooling for Axway products such as Axway Titanium SDK.

Traditionally each product has had it's own tooling such as command line tools. These tools are
usually built and maintained by separate teams with little code sharing, inconsistent user
experiences, poorly documented code, no standardized 3rd party packages, and insufficient unit
tests.

The Appc Daemon aims to solve all these issues by introducing a robust, flexible, and consistent
foundation for implementing product tooling. It does this by providing plugins that define services
which are exposed via the built-in web server to any HTTP, WebSocket, Node.js client, or shell
script.

It is designed to be highly decoupled. All product-specific logic is run inside a plugin. The Appc
Daemon provides core functionality to plugins such as filesystem watching and spawning subprocesses.
