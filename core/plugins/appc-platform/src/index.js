import appcPlatformSDK from 'appc-platform-sdk';
import autobind from 'autobind-decorator';

/**
 * Appcelerator platform integration plugin.
 */
export default class AppcPlatformService extends appcd.Service {
	/**
	 * The namespace to use for this plugin.
	 * @type {String}
	 */
	static namespace = 'appc-platform';

	/**
	 * The session object containing the user and organization informatino.
	 * @type {Object}
	 */
	session = null;

	/**
	 * Returns the status of the current session.
	 *
	 * @param {Context} ctx - The Koa request context.
	 * @access private
	 */
	init() {
		this.register('/login', this.login);
		this.router.post('/login', this.login);

		this.register('/logout', this.logout);
		this.router.get('/logout', this.logout);

		this.register('/status', this.status);
		this.router.get('/status', this.status);
	}

	/**
	 * Logs into the Appcelerator platform.
	 *
	 * @param {Context} ctx - The Koa request context.
	 * @returns {Promise}
	 * @access private
	 */
	@autobind
	login(ctx) {
		return Promise.resolve()
			.then(this.logout)
			.then(() => appcd.call('/appcd/config/machineId'))
			.then(machineId => new Promise((resolve, reject) => {

				/*
						-H, --host <host>                  host for login
					    --cloud <server>                   arrow cloud server for login
					    --dashboard <dashboard>            the dashboard url to use for logins
					    --username <username>              username for login
					    --password <password>              password for login
					    -e, --env <environment>            environment such as production, preproduction, development, etc
					    -o, --org-id <orgId>               organization id for logins
					    -r, --registry <registry>          the registry server url to use
					    -s, --server <server>              the security server url to use for logins
					    -v, --vpc-env <vpcEnv>             vpc environment for logins
				*/

				// appcPlatformSDK.setEnvironment({
				// 	baseurl: 'https://security.appcelerator.com'
				// });

				const username = ctx.request ? ctx.request.body.username : ctx.data.username;

				this.logger.info(`Logging into the Appcelerator platform as ${username}`);

				appcPlatformSDK.Auth.login({
					username: username,
					password: ctx.request ? ctx.request.body.password : ctx.data.password,
					fingerprint: machineId,
					from: ctx.source.type
				}, (err, session) => {
					this.emit('analytics:event', { type: 'appc-platform', action: 'login', success: !err, username });

					if (err) {
						this.logger.error('Login failed:');
						this.logger.error(err.toString());
						err.status = 400;
						return reject(err);
					}

					this.session = session;
					this.logger.info('Successfully logged in');

					Promise.resolve()
						.then(this.status)
						.then(resolve)
						.catch(reject);
				});
			}))
			.catch(err => {
				ctx.status = 400;
				return err;
			});
	}

	/**
	 * Logs out of the Appcelerator platform.
	 *
	 * @param {Context} ctx - The Koa request context.
	 * @returns {Promise}
	 * @access private
	 */
	@autobind
	logout(ctx) {
		return Promise.resolve()
			.then(() => new Promise((resolve, reject) => {
				if (!this.session) {
					return resolve();
				}

				this.logger.info('Logging out of the Appcelerator platform');
				appcPlatformSDK.Auth.logout(this.session, err => {
					this.session = null;
					this.logger.info('Successfully logged out');

					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			}))
			.then(this.status);
	}

	/**
	 * Returns the status of the current session.
	 *
	 * @returns {Object}
	 * @access private
	 */
	@autobind
	status() {
		if (!this.session) {
			return { loggedIn: false };
		}

		const { user } = this.session;

		return {
			loggedIn: true,
			user: {
				username: user.username,
				email: user.email
			},
			org: {
				id: user.org.org_id,
				name: user.org.name
			}
		};
	}

	/**
	 * Runs the shutdown phase by logging out of the Appcelerator platform.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	@autobind
	shutdown() {
		return this.logout();
	}
}
