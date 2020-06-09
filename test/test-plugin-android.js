import fs from 'fs-extra';
import path from 'path';
import semver from 'semver';

import {
	coreNodeVersion,
	defaultConfig,
	makeTempDir,
	makeTest,
	testLogger,
	snooplogg
} from './common';
import { real } from 'appcd-path';

const { log } = testLogger('android');
const { highlight } = snooplogg.styles;

let _it = it;
const pluginPath = path.resolve(__dirname, '..', 'plugins', 'android');
let pluginVersion;
try {
	pluginVersion = fs.readJsonSync(path.join(pluginPath, 'package.json')).version;
} catch (e) {
	_it = it.skip;
}

describe('plugin android', function () {
	this.timeout(120000);

	_it('should register the android plugin', makeTest(async function () {
		this.symlinkPlugin('android', pluginVersion);
		await this.installNode();
		await this.startDaemonDebugMode(defaultConfig);

		const { status, stdout } = this.runAppcdSync([ 'exec', '/android' ]);
		const obj = JSON.parse(stdout);

		expect(status).to.equal(0);

		expect(obj.status).to.equal(200);
		expect(obj.message).to.contain(pluginVersion);
		expect(obj.fin).to.equal(true);
		expect(obj.statusCode).to.equal('200');
	}));

	_it('should get the android plugin info', makeTest(async function () {
		this.symlinkPlugin('android', pluginVersion);
		await this.installNode();
		await this.startDaemonDebugMode(defaultConfig);

		const { status, stdout } = this.runAppcdSync([ 'exec', `/android/${pluginVersion}` ]);
		const obj = JSON.parse(stdout);

		expect(status).to.equal(0);

		expect(obj).to.be.an('object');
		expect(obj.status).to.equal(200);
		expect(obj.message).to.be.an('object');
		expect(obj.message.path).to.equal(pluginPath);
		expect(obj.message.packageName).to.equal('@appcd/plugin-android');
		expect(obj.message.version).to.equal(pluginVersion);
		expect(obj.message.main).to.equal(path.join(pluginPath, 'dist', 'index.js'));
		expect(obj.message.name).to.equal('android');
		expect(obj.message.type).to.equal('external');
		expect(obj.message.nodeVersion).to.equal(coreNodeVersion);
		expect(obj.message.supported).to.equal(true);
		expect(obj.message.services).to.deep.equal([ '/info', '/info/:filter*' ]);
		expect(obj.message.error).to.be.null;
		expect(obj.message.stack).to.be.null;
		expect(obj.message.pid).to.be.at.gt(0);
		expect(obj.message.exitCode).to.be.null;
		expect(obj.message.stats).to.be.an('object');
		expect(obj.message.startupTime).to.be.gt(1);
		expect(obj.message.state).to.equal('started');
		expect(obj.message.totalRequests).to.equal(1);
		expect(obj.message.activeRequests).to.equal(0);
		expect(obj.fin).to.equal(true);
		expect(obj.statusCode).to.equal('200');
	}));

	_it.only('should detect an Android SDK', makeTest(async function () {
		const src = path.join(__dirname, 'fixtures', 'android', 'sdk', process.platform);
		let sdkDir = makeTempDir();
		log(`Copying ${highlight(src)} => ${highlight(sdkDir)}`);
		fs.copySync(src, sdkDir);

		this.symlinkPlugin('android', pluginVersion);
		await this.installNode();
		await this.startDaemonDebugMode({
			...defaultConfig,
			android: {
				sdk: {
					searchPaths: [ sdkDir ]
				}
			}
		}, true);

		const { status, stdout } = this.runAppcdSync([ 'exec', `/android/${pluginVersion}/info` ]);
		expect(status).to.equal(0);

		const obj = JSON.parse(stdout);
		expect(obj.status).to.equal(200);

		const { message } = obj;
		let sdks;

		// targets was removed in 2.x
		if (semver.lt(pluginVersion, '2.0.0')) {
			expect(message).to.have.keys('devices', 'emulators', 'ndk', 'sdk', 'targets');
			sdks = message.sdk;
		} else {
			expect(message).to.have.keys('devices', 'emulators', 'ndks', 'sdks');
			sdks = message.sdks;
		}

		expect(sdks).to.be.an('array');
		expect(sdks).to.have.lengthOf.at.least(1);

		sdkDir = real(sdkDir);
		const bat = process.platform === 'win32' ? '.bat' : '';
		const exe = process.platform === 'win32' ? '.exe' : '';
		const sdk = sdks.find(info => info.path === sdkDir);
		expect(sdk).to.be.an('object');

		expect(sdk.buildTools).to.be.an('array');
		expect(sdk.buildTools).to.deep.equal([
			{
				dx: path.join(sdkDir, 'build-tools', '23.0.3', 'lib', 'dx.jar'),
				path: path.join(sdkDir, 'build-tools', '23.0.3'),
				version: '23.0.3',
				executables: {
					aapt: path.join(sdkDir, 'build-tools', '23.0.3', `aapt${exe}`),
					aapt2: path.join(sdkDir, 'build-tools', '23.0.3', `aapt2${exe}`),
					aidl: path.join(sdkDir, 'build-tools', '23.0.3', `aidl${exe}`),
					zipalign: path.join(sdkDir, 'build-tools', '23.0.3', `zipalign${exe}`)
				}
			}
		]);

		expect(sdk.platforms).to.be.an('array');
		expect(sdk.platforms).to.deep.equal([
			{
				aidl: path.join(sdkDir, 'platforms', 'android-23', 'framework.aidl'),
				androidJar: path.join(sdkDir, 'platforms', 'android-23', 'android.jar'),
				apiLevel: 23,
				codename: null,
				defaultSkin: 'WVGA800',
				minToolsRev: 22,
				name: 'Android 6.0',
				path: path.join(sdkDir, 'platforms', 'android-23'),
				revision: 3,
				sdk: 'android-23',
				version: '6.0',
				abis: {
					'android-tv': [
						'armeabi-v7a',
						'x86'
					],
					'android-wear': [
						'armeabi-v7a',
						'x86'
					],
					default: [
						'armeabi-v7a',
						'x86',
						'x86_64'
					],
					'google_apis': [
						'armeabi-v7a',
						'x86',
						'x86_64'
					]
				},
				skins: [
					'HVGA',
					'QVGA',
					'WQVGA400',
					'WQVGA432',
					'WSVGA',
					'WVGA800',
					'WVGA854',
					'WXGA720',
					'WXGA800',
					'WXGA800-7in',
					'AndroidWearRound',
					'AndroidWearRound360x360',
					'AndroidWearRound400x400',
					'AndroidWearRound480x480',
					'AndroidWearRoundChin320x290',
					'AndroidWearRoundChin360x325',
					'AndroidWearRoundChin360x326',
					'AndroidWearRoundChin360x330',
					'AndroidWearSquare',
					'AndroidWearSquare320x320'
				]
			},
			{
				aidl: path.join(sdkDir, 'platforms', 'android-N', 'framework.aidl'),
				androidJar: path.join(sdkDir, 'platforms', 'android-N', 'android.jar'),
				apiLevel: 23,
				codename: 'N',
				defaultSkin: 'WVGA800',
				minToolsRev: 22,
				name: 'Android N (Preview)',
				path: path.join(sdkDir, 'platforms', 'android-N'),
				revision: 2,
				sdk: 'android-N',
				version: 'N',
				abis: {},
				skins: [
					'HVGA',
					'QVGA',
					'WQVGA400',
					'WQVGA432',
					'WSVGA',
					'WVGA800',
					'WVGA854',
					'WXGA720',
					'WXGA800',
					'WXGA800-7in'
				]
			}
		]);

		expect(sdk.platformTools).to.be.an('object');
		expect(sdk.platformTools).to.deep.equal({
			path: path.join(sdkDir, 'platform-tools'),
			version: '23.1',
			executables: {
				adb: path.join(sdkDir, 'platform-tools', `adb${exe}`)
			}
		});

		expect(sdk.systemImages).to.be.an('object');
		expect(sdk.systemImages).to.deep.equal({
			'android-23/android-tv/armeabi-v7a': {
				abi: 'armeabi-v7a',
				sdk: 'android-23',
				type: 'android-tv',
				skins: []
			},
			'android-23/android-tv/x86': {
				abi: 'x86',
				sdk: 'android-23',
				type: 'android-tv',
				skins: []
			},
			'android-23/android-wear/armeabi-v7a': {
				abi: 'armeabi-v7a',
				sdk: 'android-23',
				type: 'android-wear',
				skins: [
					'AndroidWearRound',
					'AndroidWearRound360x360',
					'AndroidWearRound400x400',
					'AndroidWearRound480x480',
					'AndroidWearRoundChin320x290',
					'AndroidWearRoundChin360x325',
					'AndroidWearRoundChin360x326',
					'AndroidWearRoundChin360x330',
					'AndroidWearSquare',
					'AndroidWearSquare320x320'
				]
			},
			'android-23/android-wear/x86': {
				abi: 'x86',
				sdk: 'android-23',
				type: 'android-wear',
				skins: [
					'AndroidWearRound',
					'AndroidWearRound360x360',
					'AndroidWearRound400x400',
					'AndroidWearRound480x480',
					'AndroidWearRoundChin320x290',
					'AndroidWearRoundChin360x325',
					'AndroidWearRoundChin360x326',
					'AndroidWearRoundChin360x330',
					'AndroidWearSquare',
					'AndroidWearSquare320x320'
				]
			},
			'android-23/default/armeabi-v7a': {
				abi: 'armeabi-v7a',
				sdk: 'android-23',
				type: 'default',
				skins: []
			},
			'android-23/default/x86': {
				abi: 'x86',
				sdk: 'android-23',
				type: 'default',
				skins: []
			},
			'android-23/default/x86_64': {
				abi: 'x86_64',
				sdk: 'android-23',
				type: 'default',
				skins: []
			},
			'android-23/google_apis/armeabi-v7a': {
				abi: 'armeabi-v7a',
				sdk: 'android-23',
				type: 'google_apis',
				skins: []
			},
			'android-23/google_apis/x86': {
				abi: 'x86',
				sdk: 'android-23',
				type: 'google_apis',
				skins: []
			},
			'android-23/google_apis/x86_64': {
				abi: 'x86_64',
				sdk: 'android-23',
				type: 'google_apis',
				skins: []
			}
		});

		expect(sdk.tools).to.be.an('object');
		expect(sdk.tools).to.deep.equal({
			path: path.join(sdkDir, 'tools'),
			version: '24.4.1',
			executables: {
				android: path.join(sdkDir, 'tools', `android${bat}`),
				emulator: path.join(sdkDir, 'tools', `emulator${exe}`),
				sdkmanager: path.join(sdkDir, 'tools', 'bin', `sdkmanager${bat}`)
			}
		});
	}));
});
