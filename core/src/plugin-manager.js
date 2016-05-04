import autobind from 'autobind-decorator';
import Dispatcher from './dispatcher';
import { existsSync, expandPath, spawnNode } from './util';
import fs from 'fs';
import path from 'path';
import Plugin from './plugin';
import resolvePath from 'resolve-path';
import Router from './router';
import semver from 'semver';
import Service from './service';

export default class PluginManager {
	/**
	 * A map of all loaded plugins. The key is the plugin name and the value is
	 * a map of versions to plugin objects.
	 * @type {Object}
	 */
	plugins = {};

	/**
	 * Constructs the plugin manager instance
	 *
	 * @param {Object} opts - An object containing various options.
	 * @param {Dispatcher} opts.appcdDispatcher - The global appcd dispatcher.
	 * @param {Array} [opts.pluginPaths] - An array of paths to search for plugins during load.
	 * @param {Server} opts.server - The appcd server instance.
	 */
	constructor(opts = {}) {
		if (!(opts.appcdDispatcher instanceof Dispatcher)) {
			throw new TypeError('Expected appcdDispatcher to be a dispatcher instance');
		}

		// we must require the server at runtime to workaround circular dependencies
		const Server = require('./server');
		if (!(opts.server instanceof Server)) {
			throw new TypeError('Expected server to be a appcd server instance');
		}

		this.appcdDispatcher = opts.appcdDispatcher;
		this.pluginPaths = opts.pluginPaths || [];
		this.server = opts.server;
	}

	/**
	 * Detects, loads, and initializes plugins.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	@autobind
	load() {
		// build list of all potential plugin directories
		const pluginMap = {};

		// loads a plugin's package.json and adds it to the plugin map
		const loadPkgJson = pluginPath => {
			try {
				const pkgJson = JSON.parse(fs.readFileSync(path.join(pluginPath, 'package.json')));
				if (!pkgJson || typeof pkgJson !== 'object') {
					throw new Error('Invalid package.json, expected object');
				}

				const version = pkgJson.version;
				if (!version || typeof version !== 'string') {
					throw new Error('Invalid version in package.json');
				}

				if (!semver.valid(version)) {
					throw new Error(`Invalid version "${version}" in package.json`);
				}

				const main = pkgJson.main || 'index.js';
				let mainFile = main;
				if (!/\.js$/.test(mainFile)) {
					mainFile += '.js';
				}

				mainFile = resolvePath(pluginPath, mainFile);
				if (!existsSync(mainFile)) {
					throw new Error(`Unable to find main file: ${main}`);
				}

				const name = pkgJson.name || path.basename(pluginPath);

				if (!pluginMap[name]) {
					pluginMap[name] = {};
				}

				if (pluginMap[name][version]) {
					this.logger.warn('Skipping duplicate plugin %s', this.logger.highlight(name + '@' + version));
				} else {
					pluginMap[name][version] = {
						name,
						path: pluginPath,
						mainFile,
						pkgJson
					};
				}
			} catch (err) {
				appcd.logger.error(`Failed to load plugin ${pluginPath}`);
				appcd.logger.error(err.stack || err.toString());
				appcd.logger.error(`Skipping ${pluginPath}`);
			}
		};

		// we recursively check for a directory containing the package.json, but
		// not to exceed 2 levels deep
		(function checkDirs(dirs, depth) {
			depth = ~~depth;
			for (let dir of dirs) {
				if (existsSync(dir) && fs.statSync(dir).isDirectory()) {
					if (existsSync(path.join(dir, 'package.json'))) {
						loadPkgJson(dir);
					} else if (depth < 2) {
						checkDirs(fs.readdirSync(dir).map(name => path.join(dir, name)), depth + 1);
					}
				}
			}
		}(this.pluginPaths.map(dir => expandPath(dir)), 0));

		/*
		 * At this point we have a map of all plugins and their versions. We
		 * only want the most recent major version of each plugin.
		 */
		return Promise
			.all(Object.entries(pluginMap).map(([pluginName, pluginVersions]) => {
				return Promise
					.all(Object.entries(pluginVersions).map(([version, pluginInfo]) => new Promise((resolve, reject) => {
						// note that we do not want to return this promise chain since it could
						// contain an error and bad plugins are ingored, so that's why we wrap
						// it with another promise
						Promise.resolve()
							.then(() => {
								if (!this.server.config('appcd.skipPluginCheck')) {
									return spawnNode([ path.join(__dirname, 'check-plugin.js'), pluginInfo.mainFile ]);
								}
							})
							.then(child => {
								// if we didn't skip the plugin check, then we'll have a child
								// process object to wire up
								if (child) {
									return new Promise((resolve, reject) => {
										let output = '';
										child.stdout.on('data', data => output += data.toString());
										child.stderr.on('data', data => output += data.toString());
										child.on('close', code => {
											if (code === 3) {
												// loaded, but didn't export a class that extended appcd.Service
												appcd.logger.warn(`Plugin ${appcd.logger.highlight(pluginInfo.path)} does not export a service, skipping`);
												resolve();
											} else if (code > 0) {
												// failed to load for any number of reasons (syntax error, etc)
												reject(`Check plugin exited with code ${code}: ${output.trim()}`);
											} else {
												// plugin is good!
												resolve(true);
											}
										});
									});
								}
							})
							.then(isService => {
								if (!isService) {
									// plugin wasn't a service, try the next version
									return resolve();
								}

								// check that we don't already have this plugin loaded
								if (this.plugins[pluginName] && this.plugins[pluginName][version]) {
									throw new Error(`Already loaded plugin ${pluginName}@${version}: ${this.plugins[version].path}`);
								}

								// create the plugin descriptor
								const plugin = new Plugin({
									...pluginInfo,
									server: this.server
								});

								// add the plugin to our map of running plugins
								if (!this.plugins[pluginName]) {
									this.plugins[pluginName] = {};
								}
								this.plugins[pluginName][version] = plugin;

								appcd.logger.info('Loaded plugin %s %s', appcd.logger.highlight(pluginName + '@' + version), appcd.logger.note(pluginInfo.path));

								// init the plugin which returns a promise
								return plugin.init();
							})
							.then(resolve)
							.catch(err => {
								appcd.logger.error(appcd.logger.alert(`Failed to load plugin ${pluginInfo.path}`));
								appcd.logger.error(appcd.logger.alert(err.stack || err.toString()));
								appcd.logger.error(appcd.logger.alert(`Skipping ${pluginInfo.path}`));
								resolve();
							});
					})));
			}))
			.then(() => {
				// since the namespace can be different than the plugin name, we
				// need to construct a new map
				const namespaces = {};
				for (const pluginVersions of Object.values(this.plugins)) {
					for (const plugin of Object.values(pluginVersions)) {
						if (!namespaces[plugin.namespace]) {
							namespaces[plugin.namespace] = {};

							// wire up the dispatcher
							this.appcdDispatcher.register(`/${plugin.namespace}/:version?/:path*`, async (ctx, next) => {
								const requestedVersion = ctx.params.version || null;
								let version = null;

								if (!requestedVersion) {
									// if just the plugin namespace is requested, return an object
									// with all valid endpoints
									const endpoints = {
										latest: `/${plugin.namespace}/latest`
									};
									for (const version of Object.keys(namespaces[plugin.namespace])) {
										endpoints[version] = `/${plugin.namespace}/${version}`;
									}
									ctx.conn.end(endpoints);
									return;
								}

								// resolve the version
								const versions = Object.keys(namespaces[plugin.namespace]).sort(semver.rcompare);
								if (namespaces[plugin.namespace][requestedVersion]) {
									version = requestedVersion;
								} else if (requestedVersion === 'latest') {
									version = versions.pop();
								} else {
									for (const v of versions) {
										if (semver.satisfies(v, requestedVersion)) {
											version = v;
											break;
										}
									}
								}

								// if we found a version, forward the request
								if (version) {
									return namespaces[plugin.namespace][version].dispatcher.call('/' + (ctx.params.path || ''), ctx);
								}

								// no match, try next route
								await next();
							});
						}
						namespaces[plugin.namespace][plugin.version] = plugin;
					}
				}
			});
	}

	/**
	 * Initializes each plugin's web server routes.
	 *
	 * @param {Router} A Koa.js router.
	 * @access public
	 */
	initWebRoutes(router) {
		const namespaces = {};
		for (const pluginVersions of Object.values(this.plugins)) {
			for (const plugin of Object.values(pluginVersions)) {
				if (!namespaces[plugin.namespace]) {
					namespaces[plugin.namespace] = {};

					router.use(`/${plugin.namespace}/:version?/:path*`, async (ctx, next) => {
						const requestedVersion = ctx.params.version || null;
						let version = null;

						// resolve the version
						const versions = Object.keys(namespaces[plugin.namespace]).sort(semver.rcompare);
						if (requestedVersion && namespaces[plugin.namespace][requestedVersion]) {
							version = requestedVersion;
						} else if (requestedVersion === 'latest') {
							version = versions.pop();
						} else {
							for (const v of versions) {
								if (semver.satisfies(v, requestedVersion)) {
									version = v;
									break;
								}
							}
						}

						// if we found a version, forward the request
						if (version) {
							ctx.path = '/' + (ctx.params.path || '');
							return namespaces[plugin.namespace][version](ctx, next);
						}

						// no match, try next route
						await next();
					});
				}
				namespaces[plugin.namespace][plugin.version] = plugin.router.routes();
			}
		}
	}

	/**
	 * Returns the status of all loaded plugins.
	 *
	 * @returns {Object}
	 * @access public
	 */
	status() {
		const statuses = {};

		for (const pluginVersions of Object.values(this.plugins)) {
			for (const plugin of Object.values(pluginVersions)) {
				if (!statuses[plugin.name]) {
					statuses[plugin.name] = {};
				}
				statuses[plugin.name][plugin.version] = {
					name:    plugin.name,
					path:    plugin.path,
					version: plugin.version,
					status:  plugin.getStatus() || null
				};
			}
		}

		return statuses;
	}

	/**
	 * Shuts down all plugins.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	@autobind
	shutdown() {
		return Promise.all(Object.values(this.plugins).map(pluginVersions => {
			return Promise.all(Object.values(pluginVersions).map(plugin => plugin.shutdown()));
		}));
	}
}
