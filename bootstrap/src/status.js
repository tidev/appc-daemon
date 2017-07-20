import Table from 'cli-table2';

import { createInstanceWithDefaults, StdioStream } from 'snooplogg';
import { banner, createRequest, loadConfig } from './common';

const logger = createInstanceWithDefaults().config({ theme: 'compact' }).enable('*').pipe(new StdioStream);
const { log } = logger;
const { alert, highlight, note } = logger.styles;
const { filesize, numberFormat, relativeTime } = logger.humanize;

const cmd = {
	options: {
		'--json': { desc: 'outputs the status as JSON' }
	},
	action({ argv }) {
		const cfg = loadConfig(argv);
		const { client, request } = createRequest(cfg, '/appcd/status');

		request
			.once('error', err => {
				if (err.code === 'ECONNREFUSED') {
					if (argv.json) {
						log('{}');
					} else {
						log(banner());
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
					log(status);
					return;
				}

				log(banner());

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

				// console.log(status.plugins);
				// activeRequests
				// totalRequests

				// plugin information
				if (status.plugins.length) {
					params.head = [ 'Plugin', 'Version', 'Type', 'Path', 'Node.js', 'Status' ],
					table = new Table(params);
					for (const plugin of status.plugins) {
						let status = '';
						if (plugin.error) {
							status = alert(plugin.error);
						} else if (plugin.active) {
							if (plugin.type === 'external') {
								status = `Active, PID=${plugin.pid || 'null'}`;
							} else {
								status = 'Active';
							}
						} else {
							status = 'Inactive';
						}

						table.push([
							highlight(plugin.name),
							plugin.version,
							plugin.type,
							plugin.path,
							plugin.nodeVersion,
							status
						]);
					}
					log(table.toString());
				} else {
					log('No plugins');
				}
				log();

				// subprocess information
				if (status.subprocesses.length) {
					params.head = [ 'PID', 'Command', 'Started' ],
					table = new Table(params);
					for (const subprocess of status.subprocesses) {
						table.push([
							highlight(subprocess.pid),
							subprocess.command + (subprocess.args.length ? ` ${subprocess.args.map(a => typeof a === 'string' && a.indexOf(' ') !== -1 ? `"${a}"` : a).join(' ')}` : ''),
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

export default cmd;
