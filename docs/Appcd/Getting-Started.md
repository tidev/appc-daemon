# ![Appc Daemon logo](../images/appc-daemon.png) Daemon Project

## Getting Started

> :key: The use of _sudo_ below only applies to certain macOS and Linux machines.

### Installing via NPM

> :no_entry: _appcd_ has not yet been publically released.

```bash
sudo npm install -g appcd
```

### Installing from Github

#### Dependencies

The Appc Daemon requires Node.js 7.6.0 or newer, Gulp 3.9, and Yarn.

##### Node.js

You can download Node.js from [https://nodejs.org]([https://nodejs.org]).

##### Gulp

```bash
npm install -g gulp
```

##### Yarn

<table>
	<thead>
		<tr>
			<th>OS</th>
			<th>Command</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>macOS</td>
			<td><code>brew install yarn</code><br>
				or<br>
				<code>port install yarn</code><br>
				or<br>
				<code>curl -o- -L https://yarnpkg.com/install.sh | bash</code></td>
		</tr>
		<tr>
			<td>Windows</td>
			<td>Download from <a href="https://yarnpkg.com/latest.msi">https://yarnpkg.com/latest.msi</a></td>
		</tr>
		<tr>
			<td>Ubuntu</td>
			<td><code>curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add - echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list</code><br>
				<code>sudo apt-get update && sudo apt-get install yarn</code><br>
				or<br>
				<code>curl -o- -L https://yarnpkg.com/install.sh | bash</code></td>
		</tr>
		<tr>
			<td>CentOS / Fedora / RHEL</td>
			<td><code>sudo wget https://dl.yarnpkg.com/rpm/yarn.repo -O /etc/yum.repos.d/yarn.repo</code><br>
				<code>sudo yum install yarn</code><br>
				or<br>
				<code>curl -o- -L https://yarnpkg.com/install.sh | bash</code></td>
		</tr>
	</tbody>
</table>

Please refer to [Yarn's Installation documentation](https://yarnpkg.com/en/docs/install) for
additional information.

#### First Time Initialization

```bash
git clone git@github.com:appcelerator/appc-daemon.git
cd appc-daemon
yarn
sudo npm link
```

### Running in Production

Starts the Appc Daemon as a detached background process.

```bash
appcd start
```

To stop the server, run:

```bash
appcd stop
```

### Running in Debug Mode

Starts the Appc Daemon, but does not background the Appc Daemon Core process or detach stdio.

```bash
appcd start --debug
```

Press <kbd>CTRL-C</kbd> to stop the Appc Daemon.

### Developing the Appc Daemon

To rebuild the entire Appc Daemon project and all of its packages, simply run:

```bash
gulp build
```

When developing on the Appc Daemon, it is much faster to use the watch task:

```bash
gulp watch
```

The watch task will monitor all of the Appc Daemon packages for changes. When a file is modified, it
will rebuild that package and all parent packages, then restart the Appc Daemon.

> :bulb: Note that the `gulp watch` task is not bulletproof. If you save a .js file that contains
> malformed JavaScript code, it's likely going to cause `gulp` to exit, but the last spawned Appc
> Daemon process will remain running. You may need to run `appcd stop` or `killall appcd`.

### Debugging the Appc Daemon

Since the Appc Daemon is written using ECMAScript 6+ features not yet supported by Node.js, the
source must first be transpiled. With the slow build times and obfuscated code, interactively
debugging can very cumbersome.

The easiest solution is to simply log debug messages.

If you absolutely need to interactively debug the Appc Daemon, then you MUST use the exact Node.js
version required by the Appc Daemon Core. Run the following to build and debug the Appc Daemon:

```bash
gulp build
node inspect package/appcd-core/dist/main.js
```

Next, go to [chrome://inspect/](chrome://inspect/) in Google Chrome and you'll see the Node.js
process is ready to be inspected.

### Checking the Source Code

Periodically, run the check task to make sure all of the NPM dependencies are up-to-date and that
there is no security issues. If there are any issues, follow the recommended actions.

```bash
gulp check
```

### Updating the Source Code

After doing a `git pull` or switching a branch, you must run:

```bash
yarn
```

This will ensure all dependencies for each package match those in the `package.json` files.
