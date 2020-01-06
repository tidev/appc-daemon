const profiles = {};
for (const ver of [ 4, 6, 7, 8, 10, 12 ]) {
	profiles[`node${ver}`] = require(`./node${ver}`);
}

module.exports = function getBabelConf(opts) {
	const name = process.env.APPCD_BABEL_CONF = [
		opts && opts.babel,
		process.env.APPCD_BABEL_CONF,
		'node8'
	].reduce((p, n) => !p && n && profiles[n] ? n : p);

	return profiles[name];
};
