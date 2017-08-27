import JDKInfoService from './jdk-info-service';

const jdkInfo = new JDKInfoService();

export function activate(cfg) {
	jdkInfo.activate(cfg);
	appcd.register('/info', jdkInfo);
}

export function deactivate() {
	jdkInfo.deactivate();
}
