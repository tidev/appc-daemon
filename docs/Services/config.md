# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## `/appcd/config`

Allows config settings to be set and deleted.

### Getting Values

```
$ appcd exec /appcd/config
{ home: '~/.axway/appcd',
  foo: 'bar',
  core: { v8: { memory: 'auto' } },
  network:
   { agentOptions: null,
     caFile: null,
     certFile: null,
     httpProxy: null,
     httpsProxy: null,
     keyFile: null,
     passphrase: null,
     strictSSL: true },
  plugins: { autoReload: true, defaultInactivityTimeout: 3600000 },
  server:
   { agentPollInterval: 1000,
     daemonize: true,
     group: null,
     hostname: '127.0.0.1',
     pidFile: '~/.axway/appcd/appcd.pid',
     port: 1732,
     user: null },
  telemetry:
   { enabled: true,
     eventsDir: '~/.axway/appcd/telemetry',
     sendBatchSize: 10,
     sendInterval: 60000,
     sendTimeout: 60000,
     url: 'https://api.appcelerator.com/p/v1/app-track' },
  appcd: { guid: '14c84daf-b01e-486c-96d3-b8f66da44481' },
  environment: { name: 'preprod', title: 'Pre-production' } }
```

```
$ appcd exec /appcd/config/telemetry/sendInterval
60000
```

```
$ appcd exec /appcd/config '{"action":"get","key":"telemetry.sendInterval"}'
60000
```

### Setting Values

```
$ appcd exec /appcd/config/telemetry/sendInterval '{"action":"set","value":10000}'
OK
```

```
$ appcd exec /appcd/config '{"action":"set","key":"telemetry.sendInterval","value":5000}'
OK
```

### Deleting Values

```
$ appcd exec /appcd/config '{"action":"delete","key":"telemetry.sendInterval"}'
OK
```

```
$ appcd exec /appcd/config '{"action":"delete","key":"does_not_exist"}'
404 Not Found
```
