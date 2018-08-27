# v1.1.2

 * Removed support for period delimited filters in `DataServiceDispatcher`.
 * Updated dependencies.

# v1.1.1 (May 24, 2018)

 * Updated dependencies:
   - appcd-gulp 1.1.1 -> 1.1.5
   - appcd-logger 1.1.0 -> 1.1.1
   - appcd-response 1.1.0 -> 1.1.2
   - path-to-regexp 2.2.0 -> 2.2.1
   - source-map-support 0.5.4 -> 0.5.6

# v1.1.0 (Apr 9, 2018)

 * Fixed incorrect path reference in dispatcher preventing the request from being rerouted
   correctly.
 * Fixed route invoker to always return a `DispatcherContext`. If the handler returns a value,
   it will store the value in the original context's response.
 * Improved readme.
 * Updated dependencies:
   - appcd-gulp 1.0.1 -> 1.1.1
   - appcd-logger 1.0.1 -> 1.1.0
   - appcd-response 1.0.1 -> 1.1.0
   - gawk 4.4.4 -> 4.4.5
   - path-to-regexp 2.1.0 -> 2.2.0
   - source-map-support 0.5.0 -> 0.5.4
   - uuid 3.1.0 -> 3.2.1

# v1.0.1 (Dec 15, 2017)

 * Updated dependencies:
   - appcd-gulp 1.0.0 -> 1.0.1
   - appcd-logger 1.0.0 -> 1.0.1
   - appcd-response 1.0.0 -> 1.0.1

# v1.0.0 (Dec 5, 2017)

 - Initial release.
