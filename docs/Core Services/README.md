> [Home](../README.md) ➤ Core Services

# Core Services

 * [Config](config.md)
 * [Filesystem Watcher](fswatch.md)
 * [Logcat](logcat.md)
 * [Plugin System](plugin.md)
 * [Status](status.md)
 * [Subprocesses](subprocess.md)
 * [Telemetry](telemetry.md)

## Invoking a Service

There are 5 primary ways of invoking a service regardless if it's a core service or a service in a
plugin.

### Examples

#### `appcd` CLI

```
$ appcd exec <SERVICE_ENDPOINT>
```

View the [appcd exec](../CLI/exec.md) documentation.

#### `appcd-client`

```js
import Client from 'appcd-client';

new Client()
    .request('<SERVICE_ENDPOINT>')
    // or .request({ path: '<SERVICE_ENDPOINT>', data: {} })
    .on('response', (message, response) => {
        console.log(response);
    })
    .on('error', err => console.error(err));
```

View the [appcd-client](../Integration/Nodejs.md) documentation.

#### HTTP Client

```
$ curl http://127.0.0.1:1732/<SERVICE_ENDPOINT>
```

View the [HTTP integration](../Integration/HTTP.md) documentation.

#### appcd plugin

```js
const { response } = await appcd.call('<SERVICE_ENDPOINT>');
console.log(response);
```

#### appcd internal

```js
const { response } = await Dispatcher.call('<SERVICE_ENDPOINT>');
console.log(response);
```

> :bulb: Note: `appcd.call()` and `Dispatcher.call()` accept a string with the service endpoint
> path or an object containing a `path` property and optionally `data` and `type` properties.
>
> ```js
> appcd.call('<SERVICE_ENDPOINT>')
> ```
>
> is the same as:
>
> ```js
> appcd.call({ path: '<SERVICE_ENDPOINT>', data: {}, type: 'call' })
> ```

## Subscriptions

Some services support subscriptions where a consumer can listen to events and unsubscribe to stop
receiving events.

> :bulb: Note: Subscriptions are not support for HTTP clients.

Upon subscribing, the first response is a subscription confirmation that contains the subscription
id.

To unsubscribe, call the same service endpoint, but set request data object to:

```js
{
    type: 'unsubscribe',
    sid: '<SUBSCRIPTION_ID>'
}
```

### Examples

#### `appcd` CLI

```
$ appcd exec <SERVICE_ENDPOINT> --subscribe
```

View the [appcd exec](../CLI/exec.md) documentation.

#### `appcd-client`

```js
import Client from 'appcd-client';

new Client()
    .request({ path: '<SERVICE_ENDPOINT>', type: 'subscribe' )
    // or .request({ path: '<SERVICE_ENDPOINT>', data: {} })
    .on('response', (message, response) => {
        console.log(response);
    })
    .on('error', err => console.error(err));
```

View the [appcd-client](../Integration/Nodejs.md) documentation.

#### appcd plugin

```js
const { response } = await appcd.call('<SERVICE_ENDPOINT>', { type: 'subscribe' });
console.log(response);
```

#### appcd internal

```js
const { response } = await Dispatcher.call('<SERVICE_ENDPOINT>', { type: 'subscribe' });
console.log(response);
```
