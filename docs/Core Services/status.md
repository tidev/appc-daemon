> [Home](../README.md) ➤ [Core Services](README.md) ➤ Status Service

# Status Service

Queries that status of the daemon.

## `/appcd/status/:filter?`

Gets the daemon status and applies any filtering.

:sparkles: This service endpoint supports subscriptions.

### Request Parameters

| Name     | Required | Description                        |
| -------- | -------- | ---------------------------------- |
| `filter` |    No    | One or more segments to filter by. |

### Examples

```
$ appcd exec /appcd/status/server/loadavg
```

#### Response

```json
{
  "status": 200,
  "message": [
    2.2001953125,
    2.26953125,
    2.17529296875
  ],
  "fin": true,
  "statusCode": "200"
}
```
