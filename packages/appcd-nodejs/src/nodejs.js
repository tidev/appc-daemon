/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import appcdLogger from 'appcd-logger';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import progress from 'progress';
import request from 'appcd-request';
import tar from 'tar-stream';
import tmp from 'tmp';
import yauzl from 'yauzl';
import zlib from 'zlib';

import { execSync, spawn, spawnSync } from 'child_process';
import { isDir, isFile } from 'appcd-fs';
import { arch as getArch, formatNumber } from 'appcd-util';
import { STATUS_CODES } from 'http';

const logger = appcdLogger('appcd:nodejs');
const { highlight } = appcdLogger.styles;

const archiveRegExp = /\.(zip|pkg|tar\.gz)$/;

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
export function prepareNode({ arch, nodeHome, version } = {}) {
	if (!arch) {
		arch = getArch();
	}
	if (arch !== 'x86' && arch !== 'x64') {
		throw new Error('Expected arch to be "x86" or "x64"');
	}

	if (!nodeHome || typeof nodeHome !== 'string') {
		throw new TypeError('Expected Node home to be a non-empty string');
	}

	if (!version || typeof version !== 'string') {
		throw new TypeError('Expected version to be a non-empty string');
	}

	if (version[0] !== 'v') {
		version = `v${version}`;
	}

	const platform = process.env.APPCD_TEST_PLATFORM || process.platform;
	const binaryPath = path.join(nodeHome, version, platform, arch);
	const binary = path.join(binaryPath, platform === 'win32' ? 'node.exe' : 'node');

	logger.log('Checking %s', highlight(binary));

	if (isFile(binary) && spawnSync(binary, [ '--version' ], { encoding: 'utf8' }).stdout.trim() === version) {
		logger.log(`Node.js ${version} ready`);
		return Promise.resolve(binary);
	}

	// delete the existing path just in case
	fs.removeSync(binaryPath);

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
export function downloadNode({ arch, nodeHome, version } = {}) {
	if (version[0] !== 'v') {
		version = `v${version}`;
	}

	const platform = process.env.APPCD_TEST_PLATFORM || process.platform;

	let filename;
	if (platform === 'darwin') {
		filename = `node-${version}.pkg`;
	} else if (platform === 'win32') {
		filename = `node-${version}-win-${arch}.zip`;
	} else {
		filename = `node-${version}-${platform}-${arch}.tar.gz`;
	}

	const url = `https://nodejs.org/dist/${version}/${filename}`;
	const outFile = path.join(os.tmpdir(), filename);
	const out = fs.createWriteStream(outFile);

	logger.log('Downloading %s => %s', highlight(url), highlight(outFile));

	const {
		APPCD_NETWORK_CA_FILE,
		APPCD_NETWORK_PROXY,
		APPCD_NETWORK_STRICT_SSL
	} = process.env;

	// download node
	return Promise.resolve()
		.then(() => request({
			url,
			ca: APPCD_NETWORK_CA_FILE && isFile(APPCD_NETWORK_CA_FILE) ? fs.readFileSync(APPCD_NETWORK_CA_FILE).toString() : null,
			proxy: APPCD_NETWORK_PROXY,
			strictSSL: APPCD_NETWORK_STRICT_SSL !== 'false'
		}))
		.then(request => new Promise((resolve, reject) => {
			request
				.on('response', response => {
					if (response.statusCode !== 200) {
						return reject(new Error(`Failed to download Node.js: ${response.statusCode} - ${STATUS_CODES[response.statusCode]}`));
					}

					const len = parseInt(response.headers['content-length']);

					if (logger.enabled) {
						const bar = new progress('  [:bar] :percent :etas', {
							clear: true,
							complete: '=',
							incomplete: ' ',
							width: 50,
							total: len
						});

						response.on('data', chunk => bar.tick(chunk.length));
					}

					response.once('end', () => {
						logger.log(`Downloaded ${formatNumber(len)} bytes`);
						extractNode({
							archive: outFile,
							dest: path.join(nodeHome, version, platform, arch)
						}).then(resolve, reject);
					});
				})
				.once('error', reject)
				.pipe(out);
		}))
		.then(binary => {
			if (isFile(outFile)) {
				fs.removeSync(outFile);
			}
			return binary;
		})
		.catch(err => {
			logger.error(err);
			if (isFile(outFile)) {
				fs.removeSync(outFile);
			}
			throw err;
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
	return new Promise((resolve, reject) => {
		if (!archiveRegExp.test(archive)) {
			return reject(new Error(`Unsupported archive: ${archive}`));
		}

		if (!dest || typeof dest !== 'string') {
			return reject(new TypeError('Expected dest to be a string'));
		}

		if (!isDir(dest)) {
			logger.log('Creating %s', highlight(dest));
			fs.mkdirsSync(dest);
		}

		let target = null;
		const platform = process.env.APPCD_TEST_PLATFORM || process.platform;
		const binary = platform === 'win32' ? 'node.exe' : 'node';
		let binaryPath = path.join(dest, binary);

		if (/\.zip$/.test(archive)) {
			logger.log(`Extracting zip file: ${archive}`);
			yauzl.open(archive, { autoClose: true, lazyEntries: true }, function (err, zipfile) {
				if (err) {
					return reject(err);
				}

				zipfile
					.once('error', reject)
					.on('entry', entry => {
						if (!target) {
							target = `${entry.fileName.split('/')[0]}/${binary}`;
						}

						if (entry.fileName === target) {
							logger.log(`Found node executable (${formatNumber(entry.uncompressedSize)} bytes)`);
							zipfile.openReadStream(entry, (err, stream) => {
								stream.pipe(fs.createWriteStream(binaryPath));
								stream.once('end', () => {
									zipfile.close();
									resolve(binaryPath);
								});
							});
						} else {
							zipfile.readEntry();
						}
					})
					.once('end', resolve)
					.readEntry();
			});

		} else if (/\.pkg$/.test(archive)) {
			const dir = tmp.tmpNameSync({ prefix: 'appcd-nodejs-' });

			logger.log('Executing: %s', highlight(`pkgutil --expand "${archive}" "${dir}"`));
			let result = spawnSync('pkgutil', [ '--expand', archive, dir ]);
			if (result.status) {
				fs.removeSync(dir);
				return reject(new Error(`Failed to extract pkg: ${result.stderr.toString().trim()} (code ${result.status})`));
			}

			try {
				const cwd = path.join(dir, 'local.pkg');
				logger.log('Executing: %s', highlight(`CWD=${cwd} cat Payload | gzip -d | cpio -id`));
				execSync('cat Payload | gzip -d | cpio -id', { cwd, stdio: 'ignore' });

				const nodeBinary = path.join(dir, 'local.pkg', 'bin', 'node');
				if (isFile(nodeBinary)) {
					fs.renameSync(nodeBinary, binaryPath);
				} else {
					binaryPath = null;
				}
			} catch (e) {
				return reject(new Error(`Failed to extract pkg payload: ${e.message || e.toString()}`));
			} finally {
				fs.removeSync(dir);
			}

			resolve(binaryPath);

		} else if (/\.tar\.gz$/.test(archive)) {
			logger.log('Extracting tarball: %s', highlight(archive));

			const gunzip = zlib
				.createGunzip()
				.once('error', reject);

			const extract = tar
				.extract()
				.on('entry', (header, stream, cb) => {
					if (!target) {
						target = `${header.name.split('/')[0]}/bin/${binary}`;
					}

					if (header.name === target) {
						logger.log(`Found node executable (${formatNumber(header.size)})`);
						stream.pipe(fs.createWriteStream(binaryPath));
						stream.once('end', () => {
							extract.destroy();
							logger.log(`Setting node executable mode to ${header.mode.toString(8)}`);
							fs.chmodSync(binaryPath, header.mode);
							resolve(binaryPath);
						});
					} else {
						stream.once('end', cb).resume();
					}
				})
				.once('finish', resolve)
				.once('error', reject);

			fs.createReadStream(archive)
				.pipe(gunzip)
				.pipe(extract);
		}
	}).then(binaryPath => {
		if (binaryPath) {
			return binaryPath;
		}
		throw new Error(`Unable to find node executable in downloaded archive: ${archive}`);
	}).catch(err => {
		logger.error(err);
		throw err;
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
		return Promise.reject(new TypeError('Expected v8mem to be a number or "auto"'));
	}

	if (!arch) {
		arch = getArch();
	}
	if (arch !== 'x86' && arch !== 'x64') {
		throw new Error('Expected arch to be "x86" or "x64"');
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
					} else {
						mem = null;
					}
				}
				if (mem) {
					nodeArgs.push(`--max_old_space_size=${mem}`);
				}
			}

			args.unshift.apply(args, nodeArgs);

			const opts = {
				stdio: 'inherit'
			};
			if (detached) {
				opts.detached = true;
				opts.stdio = 'ignore';
			}

			let prettyArgs = args
				.map(s => {
					return s.indexOf(' ') === -1 ? s : `"${s}"`;
				})
				.join(' ');

			logger.log('Spawning: %s', highlight(`${node} ${prettyArgs} # ${JSON.stringify(opts)}`));

			let tries = 3;

			return (function trySpawn() {
				return Promise.resolve()
					.then(() => {
						tries--;
						const child = spawn(node, args, opts);
						if (detached) {
							child.unref();
						}
						return child.pid;
					})
					.catch(err => {
						if (err.code === 'ETXTBSY' && tries) {
							logger.log('Spawn threw ETXTBSY, retrying...');
							return new Promise((resolve, reject) => {
								setTimeout(() => trySpawn().then(resolve, reject), 50);
							});
						}
						return err;
					});
			}());
		});
}
