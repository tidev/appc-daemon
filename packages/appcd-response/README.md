# appcd-response

Library for responses and errors with i18n support and error codes.

Visit https://github.com/appcelerator/appc-daemon for more information.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Installation

	npm i appcd-response

## Usage

```js
import Response from 'appcd-response';
import { codes } from 'appcd-response';

const msg1 = new Response('foo!');

const msg2 = new Response(codes.OK);

const msg3 = new Response(codes.OK, 'foo!');
```

```js
import { AppcdError } from 'appcd-response';

throw new AppcdError(codes.BAD_REQUEST, 'Missing something important');
```

```js
import { createErrorClass } from 'appcd-response';

const MyError = createErrorClass('MyError', {
	defaultStatus:     codes.BAD_REQUEST,
	defaultStatusCode: codes.PLUGIN_BAD_REQUEST
});

const err = new MyError('Something bad');
assert(err instanceof AppcdError);
assert(err instanceof Error);
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appc-daemon/blob/master/packages/appcd-response/LICENSE
[2]: https://github.com/appcelerator/appc-daemon/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
