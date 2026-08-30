import { describe, expect, it } from 'vitest';
import { desktopNavigationGroups, isNavigationItemActive, mobileNavigation } from './navigation';

function mobileItem(label: string) {
	const item = mobileNavigation.find((candidate) => candidate.label === label);
	if (!item) throw new Error(`Missing mobile item: ${label}`);
	return item;
}

describe('application navigation', () => {
	it('keeps mobile navigation to five slots including Catat', () => {
		expect(mobileNavigation).toHaveLength(5);
		expect(mobileNavigation.filter((item) => item.primaryAction)).toHaveLength(1);
	});

	it('marks child routes under their desktop parent', () => {
		const laporan = desktopNavigationGroups
			.flatMap((group) => group.items)
			.find((item) => item.href === '/laporan');
		expect(laporan && isNavigationItemActive(laporan, '/laporan/neraca')).toBe(true);
	});

	it('uses Catat rather than Transaksi for the add form', () => {
		expect(isNavigationItemActive(mobileItem('Catat'), '/transaksi/tambah')).toBe(true);
		expect(isNavigationItemActive(mobileItem('Transaksi'), '/transaksi/tambah')).toBe(false);
	});

	it('marks Menu active for secondary destinations', () => {
		const menu = mobileItem('Menu');
		expect(isNavigationItemActive(menu, '/pajak/profil')).toBe(true);
		expect(isNavigationItemActive(menu, '/akun')).toBe(true);
		expect(isNavigationItemActive(menu, '/hutang-piutang/debt-1')).toBe(true);
		expect(isNavigationItemActive(menu, '/bantuan')).toBe(true);
		expect(isNavigationItemActive(menu, '/privasi')).toBe(true);
		expect(isNavigationItemActive(menu, '/tentang')).toBe(true);
	});
});
