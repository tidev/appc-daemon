import InfoService from './info';

export function activate() {
	appcd.register('/info', new InfoService());
}
