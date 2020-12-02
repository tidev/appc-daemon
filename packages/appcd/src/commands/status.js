export default {
	desc: 'Displays the Appc Daemon status',
	options: {
		'--json': 'Outputs the status as JSON'
	},
	async action({ argv, console }) {
		const [
			{ createTable, createRequest, loadConfig },
			{ createInstanceWithDefaults, StdioStream },
			{ filesize, numberFormat },
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
		const { alert, highlight, magenta, note } = logger.styles;
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
				table.push([ 'Node Version',       highlight(`v${status.node.version}`) ]);
				table.push([ 'Plugin API Version', highlight(`v${status.plugins.apiVersion || semver.satisfies(status.version, '^3.2.0') ? '1.1.0' : '1.0.0'}`) ]);
				log(table.toString());
				log();

				// fs watcher information
				log(magenta('Filesystem'.toUpperCase()));
				table = createTable([], 2);
				table.push([ 'Nodes',               highlight(status.fs.nodes) ]);
				table.push([ 'Node.js FS Watchers', highlight(status.fs.fswatchers) ]);
				table.push([ 'Client Watchers',     highlight(status.fs.watchers) ]);
				log(table.toString());
				log(`\n${status.fs.tree}\n`);

				// eslint-disable-next-line
				const homeRE = new RegExp(`^${os.homedir()}`);
				const now = Date.now();

				// plugin information
				if (status.plugins && status.plugins.registered.length) {
					const sorted = status.plugins.registered.sort((a, b) => {
						const r = a.name.localeCompare(b.name);
						return r === 0 ? semver.compare(a.version, b.version) : r;
					});
					const cols = [ `${magenta('Plugins')}\n  Name`, '\nPath', '\nState', 'Active/Total\nRequests', '\nIssues' ];
					const rows = [];
					let issues = false;

					for (const plugin of sorted) {
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
						if (plugin.pid && plugin.type === 'external') {
							status += ` PID=${plugin.pid || 'null'}`;
						}

						const row = [
							`  ${plugin.name}@${plugin.version}`,
							plugin.path.replace(homeRE, '~'),
							status,
							`${numberFormat(plugin.activeRequests, 0)} / ${numberFormat(plugin.totalRequests, 0)}`
						];

						if (plugin.error) {
							issues = true;
							row.push(plugin.error);
						} else {
							row.push('');
						}

						if (plugin.supported) {
							row[0] = highlight(row[0]);
							if (plugin.error) {
								row[4] = alert(row[4]);
							}
						} else {
							for (let i = 0; i < row.length; i++) {
								row[i] = note(row[i]);
							}
						}

						rows.push(row);
					}

					if (!issues) {
						cols.pop();
					}

					table = createTable(cols);
					for (const row of rows) {
						if (!issues) {
							row.pop();
						}
						table.push(row);
					}
					log(table.toString());
				} else {
					log(magenta('Plugins'.toUpperCase()));
					log('No plugins');
				}
				log();

				// subprocess information
				log(magenta('Subprocesses'.toUpperCase()));
				if (status.subprocesses.length) {
					table = createTable([ 'PID', 'Command', 'Started' ], 2);
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
							prettyMs(now - subprocess.startTime.getTime())
						]);
					}
					log(table.toString());
				} else {
					log('No subprocesses');
				}
				log();

				log(magenta('Health'.toUpperCase()));
				table = createTable([ 'Process', 'PID', 'CPU', 'Heap Used / Total', 'RSS', 'Uptime' ], 2);
				table.push([
					highlight(`appcd-core@${status.version}`),
					status.pid,
					`${status.system.loadavg[status.system.loadavg.length - 1].toFixed(1)}%`,
					`${filesize(status.memory.heapUsed)} / ${filesize(status.memory.heapTotal)}`,
					filesize(status.memory.rss),
					prettyMs(status.uptime)
				]);
				if (status.plugins && status.plugins.registered.length) {
					for (const plugin of status.plugins.registered.sort((a, b) => a.name.localeCompare(b.name))) {
						if (plugin.pid && plugin.state === 'started') {
							table.push([
								highlight(`${plugin.name}@${plugin.version}`),
								plugin.pid,
								`${plugin.stats.cpu.toFixed(1)}%`,
								`${filesize(plugin.stats.heapUsed)} / ${filesize(plugin.stats.heapTotal)}`,
								filesize(plugin.stats.rss),
								plugin.startTime ? prettyMs(now - plugin.startTime) : note('n/a')
							]);
						}
					}
				}
				log(table.toString());
				log();
			});
	}
};
