// // detect any existing yarn links
// try {
// 	const linksDir = process.platform === 'win32'
// 		? path.join(os.homedir(), 'AppData', 'Local', 'Yarn', 'Data', 'link')
// 		: path.join(os.homedir(), '.config', 'yarn', 'link');

// 	for (const rel of globule.find('*/package.json', '@*/*/package.json', { srcBase: linksDir })) {
// 		const pkgJsonFile = path.join(linksDir, rel);
// 		let appcd, name, version;

// 		try {
// 			({ appcd, name, version } = await fs.readJson(pkgJsonFile));
// 		} catch (e) {
// 			logger.warn(`Failed to parse link package.json: ${pkgJsonFile}`);
// 		}

// 		if (appcd && (!appcd.os || appcd.os.includes(process.platform))) {
// 			const linkPath = path.dirname(pkgJsonFile);

// 			if (!installed[name]) {
// 				installed[name] = {};
// 			}
// 			if (!installed[name][version]) {
// 				const dest = path.join(packagesDir, name, version);
// 				installed[name][version] = dest;

// 				await fs.mkdirs(path.dirname(dest));
// 				logger.log(`Symlinking ${highlight(linkPath)} => ${highlight(path.relative(pluginsDir, dest))}`);
// 				fs.symlinkSync(linkPath, dest, 'dir');
// 			}
// 			newWorkspaces.delete(`packages/${name}/${version}`);
// 		}
// 	}
// } catch (e) {
// 	logger.warn('The yarn links directory exists, but access is denied');
// }
