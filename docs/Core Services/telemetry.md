> [Home](../README.md) ➤ [Core Services](README.md) ➤ Telemetry Service

# Telemetry Service

The telemetry service allows various components to send data and crashes to Axway platform where it
can be used to measure usage and issues.

> :bulb: Note: The telemetry service can only be called through the dispatcher. You cannot call the
> telemetry service using the `appcd exec` CLI.

## Services Endpoints

 * [`/appcd/telemetry`](#appcdtelemetry)
 * [`/appcd/telemetry/crash`](#appcdtelemetrycrash)

## `/appcd/telemetry`

Records a single telemetry event.

### Request Payload

| Name    | Required | Description                                          |
| ------- | :------: | ---------------------------------------------------- |
| `event` |   Yes    | The event name.                                      |
| `app`   |   No     | The application guid the telemetry event belongs to. |
| `*`     |   No     | Any other data you may want to send.                 |

### Example

```js
// note: plugins use `appcd.call()`, daemon internals use `Dispatcher.call()`

await appcd.call('/appcd/telemetry', {
	event: 'some.event', // required
	app: '<GUID>', // optional

	// any additional data
	someData: 'foo',
	favoriteFruit: 'banana'
});
```

#### Response

```json
{
  "status": 201,
  "message": "Created",
  "fin": true,
  "statusCode": "201"
}
```

## `/appcd/telemetry/crash`

Records a crash event. This will only record the event if the `telemetry.environment` config
setting is set to `production`, which is the default value.

### Request Payload

| Name      | Required | Description                                          |
| --------- | :------: | ---------------------------------------------------- |
| `message` |   Yes    | The crash message.                                   |
| `app`     |   No     | The application guid the telemetry event belongs to. |
| `*`       |   No     | Any other data you may want to send.                 |

### Example

```js
// note: plugins use `appcd.call()`, daemon internals use `Dispatcher.call()`

try {
	JSON.parse('{{{{');
} catch (err) {
	await appcd.call('/appcd/telemetry/crash', {
		message: err.toString(), // required
		app: '<GUID>', // optional

		// any additional data
		stack: err.stack,
		someData: 'foo',
		favoriteFruit: 'banana'
	});
}
```

#### Response

```json
{
  "status": 201,
  "message": "Created",
  "fin": true,
  "statusCode": "201"
}
```

