export default {
	desc: 'Displays the Appc Daemon status',
	options: {
		'--json': 'Outputs the status as JSON'
	},
	async action({ argv, console }) {
		const [
			{ createTable, createRequest, loadConfig },
			{ createInstanceWithDefaults, StdioStream },
			{ filesize, numberFormat, relativeTime },
			os,
			{ default: prettyMs },
			semver
		] = await Promise.all([
			import('../common'),
			import('appcd-logger'),
			import('humanize'),
			import('os'),
			import('pretty-ms'),
			import('semver')
		]);

		const logger = createInstanceWithDefaults().config({ theme: 'compact' }).enable('*').pipe(new StdioStream());
		const { log } = logger;
		const { alert, highlight, note } = logger.styles;
		const cfg = loadConfig(argv);
		const { client, request } = createRequest(cfg, '/appcd/status');

		request
			.once('error', err => {
				if (err.code === 'ECONNREFUSED') {
					if (argv.json) {
						log('{}');
					} else {
						log('Server not running');
					}
					process.exit(3);
				} else {
					console.error(err.toString());
					process.exit(1);
				}
			})
			.on('response', status => {
				client.disconnect();

				if (argv.json) {
					log(JSON.stringify(status, null, 2));
					return;
				}

				// general information
				let table = createTable();
				table.push([ 'Core Version',       highlight(`v${status.version}`) ]);
				table.push([ 'PID',                highlight(status.pid) ]);
				table.push([ 'Uptime',             highlight(`${(status.uptime / 60).toFixed(2)} minutes`) ]);
				table.push([ 'Node Version',       highlight(`v${status.node.version}`) ]);
				table.push([ 'Plugin API Version', highlight(`v${status.plugins.apiVersion || semver.satisfies(status.version, '^3.2.0') ? '1.1.0' : '1.0.0'}`) ]);
				table.push([ 'Memory RSS',         highlight(filesize(status.memory.rss)) ]);
				table.push([ 'Memory Heap',        highlight(`${filesize(status.memory.heapUsed)} / ${filesize(status.memory.heapTotal)}`) ]);
				log(table.toString());
				log();

				// fs watcher information
				table = createTable('Filesystem Watch System');
				table.push([ 'Nodes',               highlight(status.fs.nodes) ]);
				table.push([ 'Node.js FS Watchers', highlight(status.fs.fswatchers) ]);
				table.push([ 'Client Watchers',     highlight(status.fs.watchers) ]);
				log(table.toString());
				log(status.fs.tree);
				log();

				const homeRE = new RegExp(`^${os.homedir()}`);

				// plugin information
				if (status.plugins && status.plugins.registered.length) {
					table = createTable('Plugin', 'Path', 'Status', 'Active/Total Requests');
					for (const plugin of status.plugins.registered.sort((a, b) => a.name.localeCompare(b.name))) {
						let status = 'Stopped';
						switch (plugin.state) {
							case 'started':
								status = 'Started';
								break;
							case 'starting':
								status = 'Starting';
								break;
							case 'stopping':
								status = 'Stopping';
								break;
						}
						if (plugin.error) {
							status += `${plugin.pid ? `, PID=${plugin.pid}` : ''}: ${plugin.error}`;
						} else if (plugin.pid && plugin.type === 'external') {
							status += ` PID=${plugin.pid || 'null'}`;
						}

						if (plugin.pid && plugin.startTime) {
							status += ` Uptime=${prettyMs(Date.now() - plugin.startTime)}`;
						}

						const row = [
							`${plugin.name}@${plugin.version}`,
							plugin.path.replace(homeRE, '~'),
							status,
							`${numberFormat(plugin.activeRequests, 0)} / ${numberFormat(plugin.totalRequests, 0)}`
						];

						if (plugin.supported) {
							row[0] = highlight(row[0]);
							if (plugin.error) {
								row[3] = alert(row[3]);
							}
						} else {
							for (let i = 0; i < row.length; i++) {
								row[i] = note(row[i]);
							}
						}

						table.push(row);
					}
					log(table.toString());
				} else {
					log('No plugins');
				}
				log();

				// subprocess information
				if (status.subprocesses.length) {
					table = createTable('PID', 'Command', 'Started');
					for (const subprocess of status.subprocesses) {
						let args = '';
						if (subprocess.args.length) {
							args = ' ' + subprocess.args
								.map(a => {
									if (typeof a === 'string') {
										a = a.replace(homeRE, '~');
										if (a.indexOf(' ') !== -1) {
											return `"${a}"`;
										}
									}
									return a;
								})
								.join(' ');
						}

						table.push([
							highlight(subprocess.pid),
							subprocess.command.replace(homeRE, '~') + args,
							relativeTime(subprocess.startTime.getTime() / 1000)
						]);
					}
					log(table.toString());
				} else {
					log(note('Subprocesses'));
					log('No subprocesses');
				}
				log();
			});
	}
};
