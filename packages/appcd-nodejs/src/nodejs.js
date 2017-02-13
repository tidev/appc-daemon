import del from 'del';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import progress from 'progress';
import request from 'request';
import snooplogg from 'snooplogg';
import tar from 'tar-stream';
import yauzl from 'yauzl';
import zlib from 'zlib';

import { spawn, spawnSync } from 'child_process';
import { isDir, isFile } from 'appcd-fs';
import { arch as getArch, formatNumber } from 'appcd-util';
import { STATUS_CODES } from 'http';

const log = snooplogg.config({ theme: 'detailed' })('appcd:nodejs').log;

/**
 * Ensures the correct Node.js version is installed and ready to go. If the
 * required Node.js version is not installed, initiate the download.
 *
 * @param {Object} params - Various parameters.
 * @param {String} params.arch - The compiled machine architecture.
 * @param {String} params.nodeHome - The path to where downloaded Node.js
 * binaries are stored.
 * @param {String} params.version - The Node.js version to ensure is installed.
 * @returns {Promise} Resolves the path to the requested Node.js binary.
 */
export function prepareNode({ arch, nodeHome, version }) {
	if (arch !== 'x86' && arch !== 'x64') {
		throw new Error('Expected arch to be "x86" or "x64"');
	}

	if (!nodeHome || typeof nodeHome !== 'string') {
		throw new TypeError('Expected Node home to be a non-empty string');
	}

	if (!version || typeof version !== 'string') {
		throw new TypeError('Expected version to be a non-empty string');
	}

	const binaryPath = path.join(nodeHome, version, process.platform, arch);
	const binary = path.join(binaryPath, process.platform === 'win32' ? 'node.exe' : 'node');

	if (isFile(binary) && spawnSync(binary, ['--version'], { encoding: 'utf8' }).stdout.split('\n')[0] === version) {
		log(`Node.js ${version} ready`);
		return Promise.resolve(binary);
	}

	// delete the existing path just in case
	del.sync([ binaryPath ], { force: true });

	return downloadNode({ arch, nodeHome, version });
}

/**
 * Downloads a Node.js version. The archive is extracted to the specified Node
 * home path.
 *
 * @param {Object} params - Various parameters.
 * @param {String} params.arch - The compiled machine architecture.
 * @param {String} params.nodeHome - The path to where downloaded Node.js
 * binary should be extracted to.
 * @param {String} params.version - The Node.js version to download.
 * @returns {Promise}
 */
export function downloadNode({ arch, nodeHome, version }) {
	const name = `node-${version}-${process.platform === 'win32' ? 'win' : process.platform}-${arch}`;
	const filename = `${name}.${process.platform === 'win32' ? 'zip' : 'tar.gz'}`;
	const url = `https://nodejs.org/dist/${version}/${filename}`;
	const outFile = path.join(os.tmpdir(), filename);
	const out = fs.createWriteStream(outFile);

	log(`Downloading ${url} => ${outFile}`);

	// download node
	return new Promise((resolve, reject) => {
		const {
			APPCD_NETWORK_CA_FILE,
			APPCD_NETWORK_PROXY,
			APPCD_NETWORK_STRICT_SSL
		} = process.env;

		request
			.get({
				url,
				ca: APPCD_NETWORK_CA_FILE && isFile(APPCD_NETWORK_CA_FILE) ? fs.readFileSync(APPCD_NETWORK_CA_FILE).toString() : null,
				proxy: APPCD_NETWORK_PROXY,
				strictSSL: APPCD_NETWORK_STRICT_SSL !== 'false'
			})
			.on('response', response => {
				if (response.statusCode !== 200) {
					return reject(new Error(`Failed to download Node.js: ${response.statusCode} - ${STATUS_CODES[response.statusCode]}`));
				}

				const len = parseInt(response.headers['content-length']);

				if (log.enabled) {
					const bar = new progress('  [:bar] :percent :etas', {
						clear: true,
						complete: '=',
						incomplete: ' ',
						width: 50,
						total: len
					});

					response.on('data', chunk => bar.tick(chunk.length));
				}

				response.on('end', () => {
					log(`Downloaded ${formatNumber(len)} bytes`);

					Promise.resolve()
						.then(() => extractNode({
							archive: outFile,
							dest: path.join(nodeHome, version, process.platform, arch)
						}))
						.catch(err => {
							fs.unlinkSync(outFile);
							throw err;
						})
						.then(binary => {
							fs.unlinkSync(outFile);
							resolve(binary);
						})
						.catch(reject);
				});
			})
			.on('error', reject)
			.pipe(out);
	});
}

/**
 * Extracts the download Node.js archive.
 *
 * @param {Object} params - Various parameters.
 * @param {String} params.archive - The path to the Node.js archive.
 * @param {String} params.dest - The path to extract the Node.js executable to.
 * @returns {Promise}
 */
export function extractNode({ archive, dest }) {
	if (!isDir(dest)) {
		log(`Creating ${dest}`);
		fs.mkdirsSync(dest);
	}

	return new Promise((resolve, reject) => {
		let target = null;
		const binary = process.platform === 'win32' ? 'node.exe' : 'node';
		const binaryPath = path.join(dest, binary);

		if (/\.zip$/.test(archive)) {
			log(`Extracting zip file: ${archive}`);
			yauzl.open(archive, { autoClose: true, lazyEntries: true }, function (err, zipfile) {
				if (err) {
					reject(err);
					return;
				}

				zipfile
					.on('error', reject)
					.on('entry', entry => {
						if (!target) {
							target = `${entry.fileName.split('/')[0]}/${binary}`;
						}

						if (entry.fileName === target) {
							log(`Found node executable (${formatNumber(entry.uncompressedSize)})`);
							zipfile.openReadStream(entry, (err, stream) => {
								stream.pipe(fs.createWriteStream(binaryPath));
								stream.on('end', () => {
									zipfile.close();
									resolve(binaryPath);
								});
							});
						} else {
							zipfile.readEntry();
						}
					})
					.on('end', () => {
						reject(new Error(`Unable to find node executable in downloaded archive: ${archive}`));
					})
					.readEntry();
			});
		} else if (/\.tar\.gz$/.test(archive)) {
			log(`Extracting tarball: ${archive}`);

			const extract = tar.extract()
				.on('entry', (header, stream, cb) => {
					if (!target) {
						target = `${header.name.split('/')[0]}/bin/${binary}`;
					}

					if (header.name === target) {
						log(`Found node executable (${formatNumber(header.size)})`);
						stream.pipe(fs.createWriteStream(binaryPath));
						stream.on('end', () => {
							extract.destroy();
							log(`Setting mode to ${header.mode.toString(8)}`);
							fs.chmodSync(binaryPath, header.mode);
							resolve(binaryPath);
						});
					} else {
						stream.on('end', cb).resume();
					}
				})
				.on('finish', resolve)
				.on('error', reject);

			fs.createReadStream(archive)
	    		.pipe(zlib.createGunzip())
	    		.pipe(extract);
		} else {
			reject(new Error(`Invalid archive: ${archive}`));
		}
	});
}

/**
 * Spawns the specified script using the specified Node.js version.
 *
 * @param {Object} params - Various parameters.
 * @param {String} [params.arch] - The desired Node.js architecture. Must be
 * `x86` or `x64`. Defaults to the current machine architecture.
 * @param {String} params.args - The arguments to pass into Node.js.
 * @param {Boolean} [params.detached=false] - When true, detaches the child
 * process.
 * @param {Array<String>} [params.nodeArgs] - Node and V8 arguments to pass into
 * the Node process. Useful for specifying V8 settings or enabling debugging.
 * @param {String} params.nodeHome - The path to where Node.js executables are
 * stored.
 * @param {Number|String} params.v8mem - The maximum amount of memory for child
 * Node.js process's V8 engine to use. The value must either be the number of
 * megabytes or the string `auto`, which will automatically select a sensible
 * size based on the system architecture and installed memory.
 * @param {String} params.version - The Node.js version to use.
 * @returns {Promise}
 */
export function spawnNode({ arch, args, detached, nodeHome, nodeArgs, v8mem = 'auto', version }) {
	if (v8mem && (typeof v8mem !== 'number' && v8mem !== 'auto')) {
		throw new TypeError('Expected v8mem to be a number or "auto"');
	}

	if (!arch) {
		arch = getArch();
	}

	return Promise.resolve()
		.then(() => prepareNode({ arch, nodeHome, version }))
		.then(node => {
			if (!Array.isArray(nodeArgs)) {
				nodeArgs = [];
			}

			if (v8mem && !nodeArgs.some(arg => arg.indexOf('--max_old_space_size=') === 0)) {
				let mem = v8mem;
				if (mem === 'auto') {
					const defaultMem = getArch() === 'x64' ? 1400 : 700;
					const totalMem = Math.floor(os.totalmem() / 1e6);
					// you must have at least double the RAM of the default memory amount
					if (totalMem * 0.5 > defaultMem) {
						mem = Math.min(totalMem * 0.5, 3000);
					}
				}
				nodeArgs.push(`--max_old_space_size=${mem}`);
			}

			args.unshift.apply(args, nodeArgs);

			const opts = {
				stdio: 'inherit'
			};
			if (detached) {
				opts.detached = true;
				opts.stdio = 'ignore';
			}

			log(`spawning: ${node} ${args.map(s => s.indexOf(' ') === -1 ? s : `"${s}"`).join(' ')} # ${JSON.stringify(opts)}`);
			const child = spawn(node, args, opts);
			if (detached) {
				child.unref();
			}
			return child.pid;
		});
}
