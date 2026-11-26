import { describe, expect, it } from 'vitest';
import { isCrossSiteRequest } from './csrf';

const APP = new URL('https://buku.test/api/transactions');

function request(method: string, headers: Record<string, string> = {}) {
	return new Request(APP, { method, headers });
}

describe('CSRF origin check', () => {
	it('never blocks safe methods', () => {
		for (const method of ['GET', 'HEAD', 'OPTIONS']) {
			expect(isCrossSiteRequest(request(method, { Origin: 'https://evil.test' }), APP)).toBe(false);
		}
	});

	it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('allows %s from the same origin', (method) => {
		expect(isCrossSiteRequest(request(method, { Origin: 'https://buku.test' }), APP)).toBe(false);
	});

	it.each([
		['another site', 'https://evil.test'],
		['another scheme', 'http://buku.test'],
		['another port', 'https://buku.test:8443'],
		['a subdomain', 'https://sub.buku.test'],
		['the opaque origin', 'null']
	])('blocks a POST whose Origin is %s', (_label, origin) => {
		expect(isCrossSiteRequest(request('POST', { Origin: origin }), APP)).toBe(true);
	});

	it.each(['same-origin', 'none'])(
		'allows a POST without Origin when Sec-Fetch-Site is %s',
		(fetchSite) => {
			expect(isCrossSiteRequest(request('POST', { 'Sec-Fetch-Site': fetchSite }), APP)).toBe(false);
		}
	);

	it.each(['cross-site', 'same-site'])(
		'blocks a POST without Origin when Sec-Fetch-Site is %s',
		(fetchSite) => {
			expect(isCrossSiteRequest(request('DELETE', { 'Sec-Fetch-Site': fetchSite }), APP)).toBe(
				true
			);
		}
	);

	it('blocks a state-changing request that carries neither header', () => {
		expect(isCrossSiteRequest(request('POST'), APP)).toBe(true);
		expect(isCrossSiteRequest(request('PATCH'), APP)).toBe(true);
	});
});
