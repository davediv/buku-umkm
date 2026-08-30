import {
	Calculator,
	CreditCard,
	FileText,
	Home,
	Menu,
	Plus,
	Receipt,
	Wallet
} from '@lucide/svelte';

export interface NavigationItem {
	href: string;
	label: string;
	icon: typeof Home;
	exact?: boolean;
	activePrefixes?: string[];
	excludePrefixes?: string[];
	primaryAction?: boolean;
}

export interface NavigationGroup {
	label: string;
	items: NavigationItem[];
}

export const mobileNavigation: NavigationItem[] = [
	{ href: '/beranda', label: 'Beranda', icon: Home, exact: true },
	{
		href: '/transaksi',
		label: 'Transaksi',
		icon: Receipt,
		excludePrefixes: ['/transaksi/tambah']
	},
	{
		href: '/transaksi/tambah',
		label: 'Catat',
		icon: Plus,
		exact: true,
		primaryAction: true
	},
	{ href: '/laporan', label: 'Laporan', icon: FileText },
	{
		href: '/lainnya',
		label: 'Menu',
		icon: Menu,
		activePrefixes: ['/lainnya', '/akun', '/hutang-piutang', '/pajak', '/kategori', '/pengaturan']
	}
];

export const desktopNavigationGroups: NavigationGroup[] = [
	{
		label: 'Utama',
		items: [{ href: '/beranda', label: 'Beranda', icon: Home, exact: true }]
	},
	{
		label: 'Pembukuan',
		items: [
			{
				href: '/transaksi',
				label: 'Transaksi',
				icon: Receipt,
				excludePrefixes: ['/transaksi/tambah']
			},
			{ href: '/akun', label: 'Kas & Rekening', icon: Wallet },
			{ href: '/hutang-piutang', label: 'Utang & Piutang', icon: CreditCard }
		]
	},
	{
		label: 'Pelaporan',
		items: [
			{ href: '/laporan', label: 'Laporan', icon: FileText },
			{ href: '/pajak', label: 'Pajak', icon: Calculator }
		]
	},
	{
		label: 'Administrasi',
		items: [{ href: '/lainnya', label: 'Kelola & Pengaturan', icon: Menu }]
	}
];

export const desktopCreateAction: NavigationItem = {
	href: '/transaksi/tambah',
	label: 'Catat transaksi',
	icon: Plus,
	exact: true,
	primaryAction: true
};

function matchesPath(pathname: string, route: string): boolean {
	return pathname === route || pathname.startsWith(`${route}/`);
}

export function isNavigationItemActive(item: NavigationItem, pathname: string): boolean {
	if (item.excludePrefixes?.some((prefix) => matchesPath(pathname, prefix))) return false;
	if (item.activePrefixes) {
		return item.activePrefixes.some((prefix) => matchesPath(pathname, prefix));
	}
	if (item.exact) return pathname === item.href || (item.href === '/beranda' && pathname === '/');
	return matchesPath(pathname, item.href);
}
