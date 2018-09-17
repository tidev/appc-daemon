export default {
	desc: 'displays the Appc Daemon status',
	options: {
		'--json': { desc: 'outputs the status as JSON' }
	},
	async action({ argv }) {
		const [
			{ default: Table },
			{ createRequest, loadConfig },
			{ createInstanceWithDefaults, StdioStream }
		] = await Promise.all([
			import('cli-table2'),
			import('../common'),
			import('appcd-logger')
		]);

		const logger = createInstanceWithDefaults().config({ theme: 'compact' }).enable('*').pipe(new StdioStream());
		const { log } = logger;
		const { alert, highlight, note } = logger.styles;
		const { filesize, numberFormat, relativeTime } = logger.humanize;
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

				const params = {
					chars: {
						bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
						left: '', 'left-mid': '',
						mid: '', 'mid-mid': '', middle: '  ',
						right: '', 'right-mid': '',
						top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
					},
					style: {
						head: [ 'gray' ],
						'padding-left': 0,
						'padding-right': 0
					}
				};

				// general information
				let table = new Table(params);
				table.push([ 'Core Version', highlight(`v${status.version}`) ]);
				table.push([ 'PID',          highlight(status.pid) ]);
				table.push([ 'Uptime',       highlight(`${(status.uptime / 60).toFixed(2)} minutes`) ]);
				table.push([ 'Node Version', highlight(status.node.version) ]);
				table.push([ 'Memory RSS',   highlight(filesize(status.memory.rss)) ]);
				table.push([ 'Memory Heap',  highlight(`${filesize(status.memory.heapUsed)} / ${filesize(status.memory.heapTotal)}`) ]);
				log(table.toString());
				log();

				// fs watcher information
				params.head = [ 'Filesystem Watch System' ];
				table = new Table(params);
				table.push([ 'Nodes',               highlight(status.fs.nodes) ]);
				table.push([ 'Node.js FS Watchers', highlight(status.fs.fswatchers) ]);
				table.push([ 'Client Watchers',     highlight(status.fs.watchers) ]);
				log(table.toString());
				log(status.fs.tree);
				log();

				// plugin information
				if (status.plugins && status.plugins.registered.length) {
					params.head = [ 'Plugin', 'Version', 'Type', 'Path', 'Node.js', 'Status', 'Active/Total Requests' ];
					table = new Table(params);
					for (const plugin of status.plugins.registered.sort((a, b) => a.name.localeCompare(b.name))) {
						let status = '';
						if (plugin.error) {
							status = plugin.error;
						} else if (plugin.pid) {
							if (plugin.type === 'external') {
								status = `Active, PID=${plugin.pid || 'null'}`;
							} else {
								status = 'Active';
							}
						} else {
							status = 'Inactive';
						}

						const row = [
							plugin.name,
							plugin.version,
							plugin.type,
							plugin.path,
							plugin.nodeVersion,
							status,
							`${numberFormat(plugin.activeRequests, 0)} / ${numberFormat(plugin.totalRequests, 0)}`
						];

						if (plugin.supported) {
							row[0] = highlight(row[0]);
							if (plugin.error) {
								row[5] = alert(row[5]);
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
					params.head = [ 'PID', 'Command', 'Started' ];
					table = new Table(params);
					for (const subprocess of status.subprocesses) {
						let args = '';
						if (subprocess.args.length) {
							args = ' ' + subprocess.args
								.map(a => {
									if (typeof a === 'string' && a.indexOf(' ') !== -1) {
										return `"${a}"`;
									}
									return a;
								})
								.join(' ');
						}

						table.push([
							highlight(subprocess.pid),
							subprocess.command + args,
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
