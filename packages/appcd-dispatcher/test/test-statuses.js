import path from 'path';

import { codes, statuses } from '../src/statuses';

describe('statuses', () => {
	it('should have descriptions for every code', () => {
		for (const code of Object.keys(codes)) {
			expect(statuses[code]).to.be.a.String;
		}
	});

	it('should have constants for every code', () => {
		const values = Object.values(codes);
		for (const code of Object.keys(statuses)) {
			expect(values[code]).to.be.a.Number;
		}
	});
});
