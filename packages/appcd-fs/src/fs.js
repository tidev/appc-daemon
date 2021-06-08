/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import fs from 'fs';
import path from 'path';

/**
 * Determines owner of existing parent directory, calls the operation's function, then applies the
 * owner to the destination and its newly created parent directories.
 *
 * @param {String} dest - The destination of the file or directory the operation is targetting.
 * @param {Object} opts - Various options.
 * @param {Boolean} [opts.applyOwner=true] - When `true`, determines the owner of the closest
 * existing parent directory and apply the owner to the file and any newly created directories.
 * @param {Number} [opts.gid] - The group id to apply to the file when assigning an owner.
 * @param {Number} [opts.uid] - The user id to apply to the file when assigning an owner.
 * @param {Function} fn - A function to call to perform the original filesystem operation.
 */
function execute(dest, opts, fn) {
	if (opts.applyOwner === false || process.platform === 'win32' || !process.getuid || process.getuid() !== 0) {
		fn(opts);
		return;
	}

	dest = path.resolve(dest);
	let origin = path.parse(dest).root;

	if (!opts.uid) {
		for (origin = dest; true; origin = path.dirname(origin)) {
			try {
				const st = fs.lstatSync(origin);
				if (st.isDirectory()) {
					opts = Object.assign({}, opts, { gid: st.gid, uid: st.uid });
					break;
				}
			} catch (err) {
				// continue
			}
		}
	}

	fn(opts);

	const chownSync = fs.lchownSync || fs.chownSync;
	let stat = fs.lstatSync(dest);
	while (dest !== origin && stat.uid !== opts.uid) {
		try {
			chownSync(dest, opts.uid, opts.gid);
			dest = path.dirname(dest);
			stat = fs.lstatSync(dest);
		} catch (e) {
			break;
		}
	}
}

/**
 * Determines if a file or directory exists.
 *
 * @param {String} file - The full path to check if exists.
 * @returns {Boolean}
 */
export function existsSync(file) {
	try {
		fs.statSync(file);
		return true;
	} catch (e) {
		return false;
	}
}

/**
 * Determines if a directory exists and that it is indeed a directory.
 *
 * @param {String} dir - The directory to check.
 * @returns {Boolean}
 */
export function isDir(dir) {
	try {
		return fs.statSync(dir).isDirectory();
	} catch (e) {
		// squelch
	}
	return false;
}

/**
 * Determines if a file exists and that it is indeed a file.
 *
 * @param {String} file - The file to check.
 * @returns {Boolean}
 */
export function isFile(file) {
	try {
		return fs.statSync(file).isFile();
	} catch (e) {
		// squelch
	}
	return false;
}

/**
 * Scan a directory for a specified file.
 *
 * @param {String} dir - The directory to start searching from.
 * @param {String|RegExp} filename - The name of the file to look for.
 * @param {Number} depth - Optional search depth, default 1 level.
 * @returns {String|null}
 */
export function locate(dir, filename, depth) {
	try {
		if (fs.statSync(dir).isDirectory()) {
			for (const name of fs.readdirSync(dir)) {
				const file = path.join(dir, name);
				try {
					/* eslint-disable max-depth */
					if (fs.statSync(file).isDirectory()) {
						if (typeof depth === 'undefined' || depth > 0) {
							const result = locate(file, filename, typeof depth === 'undefined' ? undefined : depth - 1);
							if (result) {
								return result;
							}
						}
					} else if ((typeof filename === 'string' && name === filename) || (filename instanceof RegExp && filename.test(name))) {
						return file;
					}
				} catch (e) {
					// probably a permission issue, go to next file
				}
			}
		}
	} catch (e) {
		// dir does not exist or permission issue
	}
	return null;
}

/**
 * Creates a directory and any parent directories if needed.
 *
 * @param {String} dest - The directory path to create.
 * @param {Object} [opts] - Various options plus options to pass into `fs.mkdirSync()`.
 * @param {Boolean} [opts.applyOwner=true] - When `true`, determines the owner of the closest
 * existing parent directory and apply the owner to the file and any newly created directories.
 * @param {Number} [opts.gid] - The group id to apply to the file when assigning an owner.
 * @param {Number} [opts.uid] - The user id to apply to the file when assigning an owner.
 */
export function mkdirpSync(dest, opts = {}) {
	execute(dest, opts, opts => {
		fs.mkdirSync(dest, { ...opts, recursive: true });
	});
}

/**
 * Moves a file.
 *
 * @param {String} src - The file or directory to move.
 * @param {String} dest - The destination to move the file or directory to.
 * @param {Object} [opts] - Various options plus options to pass into `fs.mkdirSync()` and
 * `fs.renameSync()`.
 * @param {Boolean} [opts.applyOwner=true] - When `true`, determines the owner of the closest
 * existing parent directory and apply the owner to the file and any newly created directories.
 * @param {Number} [opts.gid] - The group id to apply to the file when assigning an owner.
 * @param {Number} [opts.uid] - The user id to apply to the file when assigning an owner.
 */
export function moveSync(src, dest, opts = {}) {
	execute(dest, opts, opts => {
		mkdirpSync(path.dirname(dest), opts);
		fs.renameSync(src, dest, opts);
	});
}

/**
 * Read a directory including scoped packages as a single entry in the Array
 * and filtering out all files.
 *
 * @param {String} dir - Directory to read.
 * @returns {Array}
 */
export function readdirScopedSync(dir) {
	const children = [];

	for (const name of fs.readdirSync(dir)) {
		const childPath = path.join(dir, name);
		if (!isDir(childPath)) {
			continue;
		}
		if (name.charAt(0) === '@') {
			for (const scopedPackage of fs.readdirSync(childPath)) {
				if (isDir(path.join(childPath, scopedPackage))) {
					children.push(`${name}/${scopedPackage}`);
				}
			}
		} else {
			children.push(name);
		}
	}

	return children;
}

/**
 * Writes a file to disk.
 *
 * @param {String} dest - The name of the file to write.
 * @param {String} contents - The contents of the file to write.
 * @param {Object} [opts] - Various options plus options to pass into `fs.mkdirSync()` and
 * `fs.writeFileSync()`.
 * @param {Boolean} [opts.applyOwner=true] - When `true`, determines the owner of the closest
 * existing parent directory and apply the owner to the file and any newly created directories.
 * @param {Number} [opts.gid] - The group id to apply to the file when assigning an owner.
 * @param {Number} [opts.uid] - The user id to apply to the file when assigning an owner.
 */
export function writeFileSync(dest, contents, opts = {}) {
	execute(dest, opts, opts => {
		mkdirpSync(path.dirname(dest), opts);
		fs.writeFileSync(dest, contents, opts);
	});
}
