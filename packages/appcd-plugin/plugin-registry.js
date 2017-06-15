import fs from 'fs';
import gawk from 'gawk';
import globule from 'globule';
import path from 'path';
import Plugin from './plugin';
import PluginError from './plugin-error';
import semver from 'semver';
import snooplogg from 'snooplogg';

import { EventEmitter } from 'events';
import { isDir, isFile } from 'appcd-fs';
import { debounce } from 'appcd-util';

const logger = snooplogg.config({ theme: 'detailed' })('appcd:plugin:manager');
const { highlight, note } = snooplogg.styles;

const versionRegExp = /^v?\d\.\d\.\d$/;

export default class PluginRegistry extends EventEmitter {
	constructor() {
	}

	register(dir) {
		//
	}

	unregister(dir) {
		//
	}

	shutdown() {
	}
}


// TODO:
//   start external plugins
//   plugin host
//   stop external plugins
//   watch external plugin for exit
//   restart external plugin if crashes

//   external plugin process stats (mem, etc)

//   watch fs and reload plugin
//   namespaced dispatcher?
//   namespaced router?

	// register(pluginPath) {
	// 	if (!pluginPath) {
	// 		return;
	// 	}
	//
	// 	pluginPath = expandPath(pluginPath);
	//
	// 	if (Array.isArray(this.paths[pluginPath])) {
	// 		throw new PluginError(codes.PLUGIN_PATH_ALREADY_REGISTERED);
	// 	}
	//
	// 	const pathPlugins = this.paths[pluginPath] = [];
	//
	// 	logger.log('Registering plugin path %s', highlight(pluginPath));
	//
	// 	if (!isDir(pluginPath)) {
	// 		console.log('watching ' + pluginPath + ' for when it exists');
	// 		// Dispatcher
	// 		// 	.call('/appcd/fs/watch', { data: { path: pluginPath }, type: 'subscribe' })
	// 		// 	.then(ctx => {
	// 		// 		//
	// 		// 	});
	// 		return;
	// 	}
	//
	// 	const patterns = [
	// 		'./package.json',
	// 		'./*/package.json',
	// 		'./*/*/package.json'
	// 	];
	//
	// 	patterns.some((pattern, depth) => {
	// 		const plugins = globule
	// 			.find(pattern, { srcBase: pluginPath })
	// 			.map(pkgJsonFile => {
	// 				const dir = path.dirname(path.resolve(pluginPath, pkgJsonFile));
	// 				try {
	// 					const plugin = new Plugin(dir);
	//
	// 					// check to make sure we don't insert the same plugin twice
	// 					for (const p of this.plugins) {
	// 						if (p.name === plugin.name && p.version === plugin.version) {
	// 							throw new PluginError(codes.PLUGIN_ALREADY_REGISTERED);
	// 						}
	// 					}
	//
	// 					logger.log('Found plugin: %s', highlight(`${plugin.name}@${plugin.version}`), note(plugin.path));
	// 					this.plugins.push(plugin.info);
	// 					pathPlugins.push(plugin);
	// 					// TODO: watch dir for changes to reload or unload plugin
	// 					// if dir is nuked, stop plugin
	// 					// if dir/dist has changes, stop plugin and reinit
	// 					return plugin;
	// 				} catch (e) {
	// 					logger.warn('Invalid plugin: %s', highlight(dir));
	// 					logger.warn(e);
	// 				}
	// 			})
	// 			.filter(p => p);
	//
	// 		if (plugins.length) {
	// 			console.log('found ' + plugins.length + ' plugins');
	// 			if (depth) {
	// 				console.log('watching ' + pluginPath + ' with depth=' + depth);
	// 				// Dispatcher
	// 				// 	.call('/appcd/fs/watch', { data: { path: dir, depth }, type: 'subscribe' })
	// 				// 	.then(ctx => {
	// 				// 		//
	// 				// 	});
	// 			}
	// 			return true;
	// 		}
	// 	});
	// }

	// async unregister(pluginPath) {
	// 	if (pluginPath && typeof pluginPath === 'string') {
	// 		pluginPath = expandPath(pluginPath);
	//
	// 		for (let i = 0; i < this.plugins.length; i++) {
	// 			if (this.plugins[i].path === pluginPath) {
	// 				if (this.plugins[i].type === 'internal') {
	// 					throw new PluginError('Cannot unregister running internal plugins');
	// 				}
	// 				await this.plugins[i].stop();
	// 				this.plugins.splice(i--, 1);
	// 				return;
	// 			}
	// 		}
	// 	}
	//
	// 	throw new PluginError(codes.PLUGIN_NOT_REGISTERED);
	// }


	// 	let plugin = this.isPlugin(dir);
	// 	if (plugin) {
	// 		logger.log('Directory is a plugin');
	// 		plugins.push(plugin);
	//
	// 		// TODO: what if type is "hook"? maybe restart external plugins?
	// 		if (plugin.type === 'external') {
	// 			Dispatcher
	// 				.call('/appcd/fs/watch', { data: { path: dir, recursive: true }, type: 'subscribe' })
	// 				.then(ctx => {
	// 					const pluginChanged = debounce(evt => {
	// 						if (plugin.type === 'external') {
	// 							logger.log('Plugin %s changed, reloading...', `${plugin.name}@{plugin.version}`);
	// 							// stop the plugin and reinit
	// 							Promise.resolve()
	// 								.then(() => plugin.stop())
	// 								.then(() => plugin.init(dir));
	// 						} else {
	// 							logger.warn('Plugin %s changed, but won\'t take effect until appcd is restarted', `${plugin.name}@{plugin.version}`);
	// 						}
	// 					});
	//
	// 					ctx.response.on('data', evt => {
	// 						if (evt.message) {
	// 							switch (evt.message.action) {
	// 								case 'add':
	// 									// this should never happen
	// 									break;
	// 								case 'change':
	// 									pluginChanged(evt);
	// 									break;
	// 								case 'delete':
	// 									if (evt.message.file === dir) {
	// 										if (plugin.type === 'external') {
	// 											logger.log('Plugin %s deleted, reloading...', `${plugin.name}@{plugin.version}`);
	// 											// stop the plugin and reinit
	// 											// Promise.resolve()
	// 											// 	.then(() => plugin.stop())
	// 											// 	.then(() => plugin.init(dir));
	// 										} else {
	// 											logger.warn('Plugin %s deleted, but won\'t take effect until appcd is restarted', `${plugin.name}@{plugin.version}`);
	// 										}
	// 									}
	// 									break;
	// 							}
	// 						}
	// 					});
	// 				});
	// 		}
	//
	// 		return plugin;

	// 	logger.log('Scanning subdirectories in %s', highlight(dir));
	// 	return Promise.all(fs.readdirSync(dir).map(name => {
	// 		const subdir = path.join(dir, name);
	// 		if (!isDir(subdir)) {
	// 			return;
	// 		}
	// 		return Promise.resolve()
	// 			.then(() => this.scan(subdir, plugins))
	// 			.then(plugin => {
	// 				if (plugin) {
	// 					return plugin;
	// 				}
	// 				if (versionRegExp.test(name)) {
	// 					// subdir is a version directory
	// 					return Promise.all(fs.readdirSync(subdir).map(name => {
	// 						const subsubdir = path.join(subdir, name);
	// 						if (isDir(subsubdir)) {
	// 							this.scan(subsubdir, plugins);
	// 						}
	// 					}));
	// 				}
	// 			});
	// 	}));
	//
	//
	// 	//
	// 	// 	 && !tryRegister(subdir)) {
	// 	// 		// we have a versioned plugin
	// 	// 		for (const name of fs.readdirSync(subdir)) {
	// 	// 			if (versionRegExp.test(name)) {
	// 	// 				tryRegister(path.join(subdir, name));
	// 	// 			}
	// 	// 		}
	// 	// 	}
	// //	}
	//
	// 	// // start watching the directory for changes
	// 	// return Dispatcher
	// 	// 	.call('/appcd/fs/watch', { data: { path: dir }, type: 'subscribe' })
	// 	// 	.then(ctx => {
	// 	// 		ctx.response.on('data', evt => {
	// 	// 			if (evt.type === 'publish') {
	// 	// 				// TODO: re-detect
	// 	// 				// figure out what changed, then register/unregister
	// 	// 				console.log(evt);
	// 	// 			}
	// 	// 		});
	// 	// 	});
	// }
	//
	// /**
	//  * Registers a plugin and sends out notifications.
	//  *
	//  * @param {String} plugin - The path to the plugin to register.
	//  * @returns {Plugin}
	//  * @access public
	//  */
	// register(pluginPath) {
	// 	const plugin = new Plugin(pluginPath);
	//
	// 	logger.log('Registering plugin: %s', highlight(`${plugin.name}@${plugin.version}`));
	//
	// 	// check to make sure we don't insert the same plugin twice
	// 	for (const p of this.plugins) {
	// 		if (p.name === plugin.name && p.version === plugin.version) {
	// 			throw new PluginError(codes.PLUGIN_ALREADY_REGISTERED);
	// 		}
	// 	}
	//
	// 	logger.log('Found plugin: %s', highlight(`${plugin.name}@${plugin.version}`), note(plugin.path));
	//
	// 	// we need to duplicate the properties we're most interested in since gawking the entire
	// 	// plugin descriptor will cause a call stack exception
	// 	this.plugins.push(plugin.info);
	//
	// 	if (plugin.error) {
	// 		return;
	// 	}
	//
	// 	// initialize the namespace dispatcher
	// 	let desc = this.ns[plugin.name];
	// 	if (!desc) {
	// 	 	desc = this.ns[plugin.name] = {};
	//
	// 		Dispatcher.register(`/${plugin.name}/:version?/:path*`, async (ctx, next) => {
	// 			const versions = Object.keys(desc).sort(semver.rcompare);
	// 			let version = ctx.params.version || null;
	//
	// 			if (!version) {
	// 				logger.log('No version specified, return list of versions');
	// 				ctx.response = versions;
	// 				return;
	// 			}
	//
	// 			let plugin = desc[version];
	// 			if (!plugin) {
	// 				if (version === 'latest') {
	// 					version = versions[0];
	// 					logger.log('Remapping "%s" to "%s"', highlight('latest'), highlight(version));
	// 				} else {
	// 					for (const v of versions) {
	// 						if (semver.satisfies(v, version)) {
	// 							logger.log('Remapping "%s" to "%s"', highlight(version), highlight(v));
	// 							version = v;
	// 							break;
	// 						}
	// 					}
	// 				}
	//
	// 				plugin = version && desc[version];
	// 			}
	//
	// 			if (plugin) {
	// 				ctx.path = ctx.params.path;
	// 				return await plugin.dispatcher.handler(ctx, next);
	// 			}
	//
	// 			// not found, continue
	// 			return await next();
	// 		});
	// 	}
	//
	// 	desc[plugin.version] = plugin;
	// 	return plugin;
	// }



		/**
		 * Creates a dispatcher for the given namespace and wires up the default version routes.
		 *
		 * @param {String} namespace - The namespace to tie the dispatcher to.
		 * @returns {Dispatcher}
		 * @access private
		 * /
		createNamespaceDispatcher(namespace) {
			return new Dispatcher()
				.register('/:version?/:path*', async (ctx, next) => {
					const ns = this.namespaces[namespace];
					const versions = Object.keys(ns.versions).sort(semver.rcompare);
					let version = ctx.params.version || null;

					if (version === null) {
						// if just the plugin namespace is requested, return an object with all valid
						// versions
						logger.log('No version specified, return list of versions');
						ctx.response = {
							latest: `/${namespace}/latest`
						};
						for (const version of versions) {
							ctx.response[version] = `/${namespace}/${version}`;
						}
						return;
					}

					logger.log('Version = %s', highlight(version));
					if (version === 'latest') {
						version = versions[0];
						logger.log('Remapping latest version as %s', highlight(version));
					}

					if (ns.versions[version]) {
						logger.log('Dispatching to plugin version %s', highlight(version));
						return ns.versions[version].call(`/${ctx.params.path || ''}`, ctx);
					}

					// no match, continue
					logger.log('No version match');
					await next();
				});
		}
		*/



		// shutdown() {
			// return Promise
			// 	// stop all fs watchers
			// 	.all(Object.keys(this.paths).map(topic => {
			// 		return Dispatcher.call('/appcd/fs/watch', { topic, type: 'unsubscribe' });
			// 	}))
			//
			// 	// unload all plugins
			// 	.then(async () => {
			// 		for (let i = 0; i < this.plugins; i++) {
			// 			const plugin = this.plugins[i];
			// 			logger.log('Stopping %s', highlight(`${plugin.name}@${plugin.version}`));
			// 			try {
			// 				// await plug.unload();
			// 			} catch (e) {
			// 				if (err.code !== codes.PLUGIN_ALREADY_STOPPED) {
			// 					throw err;
			// 				}
			// 			}
			// 			this.plugins.splice(i--, 1);
			// 		}
			// 	});
		// }

		/**
		 * A map of plugin namespaces to plugin version dispatchers.
		 * @type {Object}
		 */
		// this.ns = {};
