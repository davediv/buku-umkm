/**
 * SAK EMKM Chart of Accounts Seed Data
 *
 * Contains default account templates for 4 business types:
 * - Warung Makan (Restaurant)
 * - Toko Kelontong (Mini Mart)
 * - Jasa (Services)
 * - Manufaktur (Manufacturing)
 *
 * Structure follows SAK EMKM:
 * - 1xxx: Assets (Aktiva)
 * - 2xxx: Liabilities (Kewajiban)
 * - 3xxx: Equity (Ekuitas)
 * - 4xxx: Revenue (Pendapatan)
 * - 5xxx-8xxx: Expenses (Beban)
 */

// Type definitions for templates (not actual DB types)

// ============================================================================
// Account Templates by Business Type
// ============================================================================

export type AccountTemplate = {
	code: string;
	name: string;
	type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
	subType?: string;
	isSystem: boolean;
};

export type CategoryTemplate = {
	code: string;
	name: string;
	type: 'income' | 'expense';
	isSystem: boolean;
	icon?: string;
	color?: string;
};

// ============================================================================
// Transaction Template Types
// ============================================================================

export type TransactionTemplateData = {
	name: string;
	type: 'income' | 'expense';
	categoryName?: string;
	description?: string;
};

// ============================================================================
// Warung Makan (Restaurant) Template
// ============================================================================

export const warungMakanAccounts: AccountTemplate[] = [
	// Assets - 1xxx
	{ code: '1101', name: 'Kas', type: 'asset', subType: 'kas', isSystem: true },
	{ code: '1102', name: 'Bank BCA', type: 'asset', subType: 'bank', isSystem: true },
	{ code: '1103', name: 'Bank BRI', type: 'asset', subType: 'bank', isSystem: false },
	{ code: '1201', name: 'Piutang Usaha', type: 'asset', subType: 'piutang', isSystem: true },
	{
		code: '1301',
		name: 'Persediaan Bahan Baku',
		type: 'asset',
		subType: 'persediaan',
		isSystem: true
	},
	{
		code: '1302',
		name: 'Persediaan Makanan Jadi',
		type: 'asset',
		subType: 'persediaan',
		isSystem: true
	},
	{
		code: '1303',
		name: 'Persediaan Bahan Kemasan',
		type: 'asset',
		subType: 'persediaan',
		isSystem: false
	},
	{ code: '1401', name: 'Uang Muka Supplier', type: 'asset', subType: 'piutang', isSystem: false },
	{
		code: '1501',
		name: 'Peralatan Dapur',
		type: 'asset',
		subType: 'aktiva_tetap',
		isSystem: false
	},
	{
		code: '1502',
		name: 'Akumulasi Penyusutan Peralatan',
		type: 'asset',
		subType: 'aktiva_tetap',
		isSystem: false
	},
	{ code: '1601', name: 'Kendaraan', type: 'asset', subType: 'aktiva_tetap', isSystem: false },
	{
		code: '1602',
		name: 'Akumulasi Penyusutan Kendaraan',
		type: 'asset',
		subType: 'aktiva_tetap',
		isSystem: false
	},

	// Liabilities - 2xxx
	{
		code: '2101',
		name: 'Hutang Usaha',
		type: 'liability',
		subType: 'hutang_usaha',
		isSystem: true
	},
	{
		code: '2102',
		name: 'Hutang Pajak',
		type: 'liability',
		subType: 'hutang_pajak',
		isSystem: true
	},
	{
		code: '2201',
		name: 'Uang Muka Pelanggan',
		type: 'liability',
		subType: 'hutang',
		isSystem: false
	},
	{ code: '2301', name: 'Kredit Bank', type: 'liability', subType: 'kredit', isSystem: false },

	// Equity - 3xxx
	{ code: '3101', name: 'Modal Awal', type: 'equity', subType: 'modal', isSystem: true },
	{ code: '3102', name: 'Laba Ditahan', type: 'equity', subType: 'laba', isSystem: true },
	{ code: '3201', name: 'Prive', type: 'equity', subType: 'prive', isSystem: false },

	// Revenue - 4xxx
	{
		code: '4101',
		name: 'Pendapatan Penjualan Makanan',
		type: 'revenue',
		subType: 'penjualan',
		isSystem: true
	},
	{
		code: '4102',
		name: 'Pendapatan Penjualan Minuman',
		type: 'revenue',
		subType: 'penjualan',
		isSystem: true
	},
	{
		code: '4103',
		name: 'Pendapatan Layanan Reservasi',
		type: 'revenue',
		subType: 'jasa',
		isSystem: false
	},

	// Expenses - 5xxx-8xxx
	{ code: '5101', name: 'Beban Bahan Baku', type: 'expense', subType: 'bahan', isSystem: true },
	{ code: '5102', name: 'Beban Minuman', type: 'expense', subType: 'bahan', isSystem: true },
	{ code: '5201', name: 'Beban Gaji Karyawan', type: 'expense', subType: 'gaji', isSystem: true },
	{ code: '5202', name: 'Beban Tunjangan', type: 'expense', subType: 'gaji', isSystem: false },
	{ code: '5301', name: 'Beban Listrik', type: 'expense', subType: 'utilitas', isSystem: true },
	{ code: '5302', name: 'Beban Air', type: 'expense', subType: 'utilitas', isSystem: true },
	{ code: '5303', name: 'Beban Gas', type: 'expense', subType: 'utilitas', isSystem: true },
	{ code: '5401', name: 'Beban Sewa', type: 'expense', subType: 'sewa', isSystem: true },
	{
		code: '5501',
		name: 'Beban Pemeliharaan',
		type: 'expense',
		subType: 'pemeliharaan',
		isSystem: false
	},
	{ code: '5601', name: 'Beban Iklan', type: 'expense', subType: 'pemasaran', isSystem: false },
	{
		code: '5701',
		name: 'Beban Supplies Dapur',
		type: 'expense',
		subType: 'supplies',
		isSystem: false
	},
	{
		code: '5801',
		name: 'Beban Penyusutan',
		type: 'expense',
		subType: 'penyusutan',
		isSystem: false
	},
	{ code: '5901', name: 'Beban Lain-lain', type: 'expense', subType: 'lain', isSystem: false }
];

export const warungMakanCategories: CategoryTemplate[] = [
	// Income Categories
	{
		code: '4101',
		name: 'Penjualan Makanan',
		type: 'income',
		isSystem: true,
		icon: 'UtensilsCrossed',
		color: '#22c55e'
	},
	{
		code: '4102',
		name: 'Penjualan Minuman',
		type: 'income',
		isSystem: true,
		icon: 'Coffee',
		color: '#14b8a6'
	},
	{
		code: '4103',
		name: 'Pendapatan Reservasi',
		type: 'income',
		isSystem: false,
		icon: 'Calendar',
		color: '#8b5cf6'
	},

	// Expense Categories
	{
		code: '5101',
		name: 'Bahan Baku',
		type: 'expense',
		isSystem: true,
		icon: 'Package',
		color: '#f59e0b'
	},
	{
		code: '5102',
		name: 'Bahan Minuman',
		type: 'expense',
		isSystem: true,
		icon: 'Wine',
		color: '#ec4899'
	},
	{
		code: '5201',
		name: 'Gaji Karyawan',
		type: 'expense',
		isSystem: true,
		icon: 'Users',
		color: '#3b82f6'
	},
	{
		code: '5202',
		name: 'Tunjangan',
		type: 'expense',
		isSystem: false,
		icon: 'Gift',
		color: '#6366f1'
	},
	{ code: '5301', name: 'Listrik', type: 'expense', isSystem: true, icon: 'Zap', color: '#eab308' },
	{
		code: '5302',
		name: 'Air',
		type: 'expense',
		isSystem: true,
		icon: 'Droplets',
		color: '#0ea5e9'
	},
	{ code: '5303', name: 'Gas', type: 'expense', isSystem: true, icon: 'Flame', color: '#f97316' },
	{
		code: '5401',
		name: 'Sewa Tempat',
		type: 'expense',
		isSystem: true,
		icon: 'Building',
		color: '#78716c'
	},
	{
		code: '5501',
		name: 'Pemeliharaan',
		type: 'expense',
		isSystem: false,
		icon: 'Wrench',
		color: '#a8a29e'
	},
	{
		code: '5601',
		name: 'Iklan & Promosi',
		type: 'expense',
		isSystem: false,
		icon: 'Megaphone',
		color: '#f43f5e'
	},
	{
		code: '5701',
		name: 'Supplies Dapur',
		type: 'expense',
		isSystem: false,
		icon: 'ShoppingCart',
		color: '#84cc16'
	},
	{
		code: '5801',
		name: 'Penyusutan',
		type: 'expense',
		isSystem: false,
		icon: 'TrendingDown',
		color: '#6b7280'
	},
	{
		code: '5901',
		name: 'Beban Lain',
		type: 'expense',
		isSystem: false,
		icon: 'MoreHorizontal',
		color: '#9ca3af'
	}
];

// ============================================================================
// Toko Kelontong (Mini Mart) Template
// ============================================================================

export const tokoKelontongAccounts: AccountTemplate[] = [
	// Assets - 1xxx
	{ code: '1101', name: 'Kas', type: 'asset', subType: 'kas', isSystem: true },
	{ code: '1102', name: 'Bank BCA', type: 'asset', subType: 'bank', isSystem: true },
	{ code: '1103', name: 'Bank Mandiri', type: 'asset', subType: 'bank', isSystem: false },
	{ code: '1201', name: 'Piutang Usaha', type: 'asset', subType: 'piutang', isSystem: true },
	{
		code: '1301',
		name: 'Persediaan Barang Dagangan',
		type: 'asset',
		subType: 'persediaan',
		isSystem: true
	},
	{
		code: '1302',
		name: 'Persediaan Kemasan',
		type: 'asset',
		subType: 'persediaan',
		isSystem: false
	},
	{ code: '1401', name: 'Uang Muka Supplier', type: 'asset', subType: 'piutang', isSystem: false },
	{ code: '1501', name: 'Peralatan Toko', type: 'asset', subType: 'aktiva_tetap', isSystem: false },
	{
		code: '1502',
		name: 'Akumulasi Penyusutan',
		type: 'asset',
		subType: 'aktiva_tetap',
		isSystem: false
	},
	{
		code: '1601',
		name: 'Kendaraan Delivery',
		type: 'asset',
		subType: 'aktiva_tetap',
		isSystem: false
	},

	// Liabilities - 2xxx
	{
		code: '2101',
		name: 'Hutang Usaha',
		type: 'liability',
		subType: 'hutang_usaha',
		isSystem: true
	},
	{
		code: '2102',
		name: 'Hutang Pajak',
		type: 'liability',
		subType: 'hutang_pajak',
		isSystem: true
	},
	{ code: '2301', name: 'Kredit Supplier', type: 'liability', subType: 'kredit', isSystem: false },

	// Equity - 3xxx
	{ code: '3101', name: 'Modal Awal', type: 'equity', subType: 'modal', isSystem: true },
	{ code: '3102', name: 'Laba Ditahan', type: 'equity', subType: 'laba', isSystem: true },
	{ code: '3201', name: 'Prive', type: 'equity', subType: 'prive', isSystem: false },

	// Revenue - 4xxx
	{
		code: '4101',
		name: 'Pendapatan Penjualan Barang',
		type: 'revenue',
		subType: 'penjualan',
		isSystem: true
	},
	{
		code: '4102',
		name: 'Pendapatan Grosir',
		type: 'revenue',
		subType: 'penjualan',
		isSystem: false
	},

	// Expenses - 5xxx-8xxx
	{
		code: '5101',
		name: 'Beban Harga Pokok Penjualan',
		type: 'expense',
		subType: 'hpp',
		isSystem: true
	},
	{ code: '5201', name: 'Beban Gaji Karyawan', type: 'expense', subType: 'gaji', isSystem: true },
	{ code: '5301', name: 'Beban Listrik', type: 'expense', subType: 'utilitas', isSystem: true },
	{ code: '5302', name: 'Beban Air', type: 'expense', subType: 'utilitas', isSystem: true },
	{
		code: '5303',
		name: 'Beban Telepon/Internet',
		type: 'expense',
		subType: 'utilitas',
		isSystem: false
	},
	{ code: '5401', name: 'Beban Sewa', type: 'expense', subType: 'sewa', isSystem: true },
	{
		code: '5501',
		name: 'Beban Transportasi',
		type: 'expense',
		subType: 'transport',
		isSystem: false
	},
	{ code: '5601', name: 'Beban Promosi', type: 'expense', subType: 'pemasaran', isSystem: false },
	{
		code: '5701',
		name: 'Beban Supplies Toko',
		type: 'expense',
		subType: 'supplies',
		isSystem: false
	},
	{
		code: '5801',
		name: 'Beban Penyusutan',
		type: 'expense',
		subType: 'penyusutan',
		isSystem: false
	},
	{ code: '5901', name: 'Beban Lain-lain', type: 'expense', subType: 'lain', isSystem: false }
];

export const tokoKelontongCategories: CategoryTemplate[] = [
	// Income Categories
	{
		code: '4101',
		name: 'Penjualan Eceran',
		type: 'income',
		isSystem: true,
		icon: 'ShoppingBag',
		color: '#22c55e'
	},
	{
		code: '4102',
		name: 'Penjualan Grosir',
		type: 'income',
		isSystem: false,
		icon: 'Truck',
		color: '#14b8a6'
	},

	// Expense Categories
	{
		code: '5101',
		name: 'HPP - Barang Dagang',
		type: 'expense',
		isSystem: true,
		icon: 'Package',
		color: '#f59e0b'
	},
	{
		code: '5201',
		name: 'Gaji Karyawan',
		type: 'expense',
		isSystem: true,
		icon: 'Users',
		color: '#3b82f6'
	},
	{ code: '5301', name: 'Listrik', type: 'expense', isSystem: true, icon: 'Zap', color: '#eab308' },
	{
		code: '5302',
		name: 'Air',
		type: 'expense',
		isSystem: true,
		icon: 'Droplets',
		color: '#0ea5e9'
	},
	{
		code: '5303',
		name: 'Telepon & Internet',
		type: 'expense',
		isSystem: false,
		icon: 'Phone',
		color: '#8b5cf6'
	},
	{
		code: '5401',
		name: 'Sewa Toko',
		type: 'expense',
		isSystem: true,
		icon: 'Building',
		color: '#78716c'
	},
	{
		code: '5501',
		name: 'Transportasi',
		type: 'expense',
		isSystem: false,
		icon: 'Car',
		color: '#6366f1'
	},
	{
		code: '5601',
		name: 'Promosi',
		type: 'expense',
		isSystem: false,
		icon: 'Megaphone',
		color: '#f43f5e'
	},
	{
		code: '5701',
		name: 'Supplies Toko',
		type: 'expense',
		isSystem: false,
		icon: 'ShoppingCart',
		color: '#84cc16'
	},
	{
		code: '5801',
		name: 'Penyusutan',
		type: 'expense',
		isSystem: false,
		icon: 'TrendingDown',
		color: '#6b7280'
	},
	{
		code: '5901',
		name: 'Beban Lain',
		type: 'expense',
		isSystem: false,
		icon: 'MoreHorizontal',
		color: '#9ca3af'
	}
];

// ============================================================================
// Jasa (Services) Template
// ============================================================================

export const jasaAccounts: AccountTemplate[] = [
	// Assets - 1xxx
	{ code: '1101', name: 'Kas', type: 'asset', subType: 'kas', isSystem: true },
	{ code: '1102', name: 'Bank', type: 'asset', subType: 'bank', isSystem: true },
	{ code: '1201', name: 'Piutang Usaha', type: 'asset', subType: 'piutang', isSystem: true },
	{ code: '1202', name: 'Piutang Belum Tagih', type: 'asset', subType: 'piutang', isSystem: false },
	{ code: '1301', name: 'Uang Muka Kerja', type: 'asset', subType: 'piutang', isSystem: false },
	{
		code: '1501',
		name: 'Peralatan Kantor',
		type: 'asset',
		subType: 'aktiva_tetap',
		isSystem: false
	},
	{
		code: '1502',
		name: 'Akumulasi Penyusutan',
		type: 'asset',
		subType: 'aktiva_tetap',
		isSystem: false
	},
	{ code: '1601', name: 'Kendaraan', type: 'asset', subType: 'aktiva_tetap', isSystem: false },

	// Liabilities - 2xxx
	{
		code: '2101',
		name: 'Hutang Usaha',
		type: 'liability',
		subType: 'hutang_usaha',
		isSystem: true
	},
	{
		code: '2102',
		name: 'Hutang Pajak',
		type: 'liability',
		subType: 'hutang_pajak',
		isSystem: true
	},
	{
		code: '2201',
		name: 'Uang Muka Cliente',
		type: 'liability',
		subType: 'hutang',
		isSystem: false
	},

	// Equity - 3xxx
	{ code: '3101', name: 'Modal Awal', type: 'equity', subType: 'modal', isSystem: true },
	{ code: '3102', name: 'Laba Ditahan', type: 'equity', subType: 'laba', isSystem: true },
	{ code: '3201', name: 'Prive', type: 'equity', subType: 'prive', isSystem: false },

	// Revenue - 4xxx
	{ code: '4101', name: 'Pendapatan Jasa', type: 'revenue', subType: 'jasa', isSystem: true },
	{
		code: '4102',
		name: 'Pendapatan Konsultasi',
		type: 'revenue',
		subType: 'jasa',
		isSystem: false
	},
	{ code: '4103', name: 'Pendapatan Komisi', type: 'revenue', subType: 'komisi', isSystem: false },

	// Expenses - 5xxx-8xxx
	{ code: '5101', name: 'Beban Material', type: 'expense', subType: 'material', isSystem: false },
	{ code: '5201', name: 'Beban Gaji', type: 'expense', subType: 'gaji', isSystem: true },
	{ code: '5202', name: 'Beban Honorarium', type: 'expense', subType: 'gaji', isSystem: false },
	{ code: '5301', name: 'Beban Listrik', type: 'expense', subType: 'utilitas', isSystem: true },
	{ code: '5302', name: 'Beban Air', type: 'expense', subType: 'utilitas', isSystem: false },
	{
		code: '5303',
		name: 'Beban Telepon/Internet',
		type: 'expense',
		subType: 'utilitas',
		isSystem: true
	},
	{ code: '5401', name: 'Beban Sewa Kantor', type: 'expense', subType: 'sewa', isSystem: true },
	{
		code: '5501',
		name: 'Beban Perawatan',
		type: 'expense',
		subType: 'pemeliharaan',
		isSystem: false
	},
	{ code: '5601', name: 'Beban Iklan', type: 'expense', subType: 'pemasaran', isSystem: false },
	{
		code: '5701',
		name: 'Beban Supplies Kantor',
		type: 'expense',
		subType: 'supplies',
		isSystem: false
	},
	{
		code: '5801',
		name: 'Beban Penyusutan',
		type: 'expense',
		subType: 'penyusutan',
		isSystem: false
	},
	{ code: '5901', name: 'Beban Lain-lain', type: 'expense', subType: 'lain', isSystem: false }
];

export const jasaCategories: CategoryTemplate[] = [
	// Income Categories
	{
		code: '4101',
		name: 'Jasa Layanan',
		type: 'income',
		isSystem: true,
		icon: 'Briefcase',
		color: '#22c55e'
	},
	{
		code: '4102',
		name: 'Konsultasi',
		type: 'income',
		isSystem: false,
		icon: 'MessageSquare',
		color: '#14b8a6'
	},
	{
		code: '4103',
		name: 'Komisi',
		type: 'income',
		isSystem: false,
		icon: 'Percent',
		color: '#8b5cf6'
	},

	// Expense Categories
	{
		code: '5101',
		name: 'Material',
		type: 'expense',
		isSystem: false,
		icon: 'Package',
		color: '#f59e0b'
	},
	{
		code: '5201',
		name: 'Gaji Karyawan',
		type: 'expense',
		isSystem: true,
		icon: 'Users',
		color: '#3b82f6'
	},
	{
		code: '5202',
		name: 'Honorarium',
		type: 'expense',
		isSystem: false,
		icon: 'UserCheck',
		color: '#6366f1'
	},
	{ code: '5301', name: 'Listrik', type: 'expense', isSystem: true, icon: 'Zap', color: '#eab308' },
	{
		code: '5302',
		name: 'Air',
		type: 'expense',
		isSystem: false,
		icon: 'Droplets',
		color: '#0ea5e9'
	},
	{
		code: '5303',
		name: 'Telepon & Internet',
		type: 'expense',
		isSystem: true,
		icon: 'Phone',
		color: '#8b5cf6'
	},
	{
		code: '5401',
		name: 'Sewa Kantor',
		type: 'expense',
		isSystem: true,
		icon: 'Building',
		color: '#78716c'
	},
	{
		code: '5501',
		name: 'Perawatan',
		type: 'expense',
		isSystem: false,
		icon: 'Wrench',
		color: '#a8a29e'
	},
	{
		code: '5601',
		name: 'Iklan & Marketing',
		type: 'expense',
		isSystem: false,
		icon: 'Megaphone',
		color: '#f43f5e'
	},
	{
		code: '5701',
		name: 'Supplies Kantor',
		type: 'expense',
		isSystem: false,
		icon: 'Paperclip',
		color: '#84cc16'
	},
	{
		code: '5801',
		name: 'Penyusutan',
		type: 'expense',
		isSystem: false,
		icon: 'TrendingDown',
		color: '#6b7280'
	},
	{
		code: '5901',
		name: 'Beban Lain',
		type: 'expense',
		isSystem: false,
		icon: 'MoreHorizontal',
		color: '#9ca3af'
	}
];

// ============================================================================
// Manufaktur (Manufacturing) Template
// ============================================================================

export const manufakturAccounts: AccountTemplate[] = [
	// Assets - 1xxx
	{ code: '1101', name: 'Kas', type: 'asset', subType: 'kas', isSystem: true },
	{ code: '1102', name: 'Bank', type: 'asset', subType: 'bank', isSystem: true },
	{ code: '1201', name: 'Piutang Usaha', type: 'asset', subType: 'piutang', isSystem: true },
	{
		code: '1301',
		name: 'Persediaan Bahan Baku',
		type: 'asset',
		subType: 'persediaan',
		isSystem: true
	},
	{
		code: '1302',
		name: 'Persediaan Barang Dalam Proses',
		type: 'asset',
		subType: 'persediaan',
		isSystem: true
	},
	{
		code: '1303',
		name: 'Persediaan Barang Jadi',
		type: 'asset',
		subType: 'persediaan',
		isSystem: true
	},
	{
		code: '1304',
		name: 'Persediaan Spare Parts',
		type: 'asset',
		subType: 'persediaan',
		isSystem: false
	},
	{ code: '1401', name: 'Uang Muka Supplier', type: 'asset', subType: 'piutang', isSystem: false },
	{
		code: '1501',
		name: 'Mesin & Peralatan',
		type: 'asset',
		subType: 'aktiva_tetap',
		isSystem: false
	},
	{
		code: '1502',
		name: 'Akumulasi Penyusutan Mesin',
		type: 'asset',
		subType: 'aktiva_tetap',
		isSystem: false
	},
	{ code: '1601', name: 'Gedung Pabrik', type: 'asset', subType: 'aktiva_tetap', isSystem: false },
	{
		code: '1602',
		name: 'Akumulasi Penyusutan Gedung',
		type: 'asset',
		subType: 'aktiva_tetap',
		isSystem: false
	},
	{ code: '1701', name: 'Kendaraan', type: 'asset', subType: 'aktiva_tetap', isSystem: false },

	// Liabilities - 2xxx
	{
		code: '2101',
		name: 'Hutang Usaha',
		type: 'liability',
		subType: 'hutang_usaha',
		isSystem: true
	},
	{
		code: '2102',
		name: 'Hutang Pajak',
		type: 'liability',
		subType: 'hutang_pajak',
		isSystem: true
	},
	{ code: '2201', name: 'Hutang Bank', type: 'liability', subType: 'kredit', isSystem: false },
	{
		code: '2301',
		name: 'Uang Muka Pelanggan',
		type: 'liability',
		subType: 'hutang',
		isSystem: false
	},

	// Equity - 3xxx
	{ code: '3101', name: 'Modal Awal', type: 'equity', subType: 'modal', isSystem: true },
	{ code: '3102', name: 'Laba Ditahan', type: 'equity', subType: 'laba', isSystem: true },
	{ code: '3201', name: 'Prive', type: 'equity', subType: 'prive', isSystem: false },

	// Revenue - 4xxx
	{
		code: '4101',
		name: 'Pendapatan Penjualan Produk',
		type: 'revenue',
		subType: 'penjualan',
		isSystem: true
	},
	{
		code: '4102',
		name: 'Pendapatan Jasa Produksi',
		type: 'revenue',
		subType: 'jasa',
		isSystem: false
	},

	// Expenses - 5xxx-8xxx
	{ code: '5101', name: 'Beban Bahan Baku', type: 'expense', subType: 'bahan', isSystem: true },
	{
		code: '5102',
		name: 'Beban Overhead Pabrik',
		type: 'expense',
		subType: 'overhead',
		isSystem: true
	},
	{ code: '5201', name: 'Beban Gaji Produksi', type: 'expense', subType: 'gaji', isSystem: true },
	{ code: '5202', name: 'Beban Gaji Admin', type: 'expense', subType: 'gaji', isSystem: true },
	{
		code: '5301',
		name: 'Beban Listrik Pabrik',
		type: 'expense',
		subType: 'utilitas',
		isSystem: true
	},
	{ code: '5302', name: 'Beban Air Pabrik', type: 'expense', subType: 'utilitas', isSystem: true },
	{ code: '5303', name: 'Bahan Bakar', type: 'expense', subType: 'utilitas', isSystem: false },
	{ code: '5401', name: 'Beban Sewa Pabrik', type: 'expense', subType: 'sewa', isSystem: false },
	{
		code: '5501',
		name: 'Beban Perawatan Mesin',
		type: 'expense',
		subType: 'pemeliharaan',
		isSystem: true
	},
	{ code: '5601', name: 'Beban Iklan', type: 'expense', subType: 'pemasaran', isSystem: false },
	{
		code: '5701',
		name: 'Beban Transportasi',
		type: 'expense',
		subType: 'transport',
		isSystem: false
	},
	{
		code: '5801',
		name: 'Beban Penyusutan Mesin',
		type: 'expense',
		subType: 'penyusutan',
		isSystem: true
	},
	{
		code: '5802',
		name: 'Beban Penyusutan Gedung',
		type: 'expense',
		subType: 'penyusutan',
		isSystem: false
	},
	{ code: '5901', name: 'Beban Lain-lain', type: 'expense', subType: 'lain', isSystem: false }
];

export const manufakturCategories: CategoryTemplate[] = [
	// Income Categories
	{
		code: '4101',
		name: 'Penjualan Produk',
		type: 'income',
		isSystem: true,
		icon: 'Package',
		color: '#22c55e'
	},
	{
		code: '4102',
		name: 'Jasa Produksi',
		type: 'income',
		isSystem: false,
		icon: 'Settings',
		color: '#14b8a6'
	},

	// Expense Categories
	{
		code: '5101',
		name: 'Bahan Baku',
		type: 'expense',
		isSystem: true,
		icon: 'Box',
		color: '#f59e0b'
	},
	{
		code: '5102',
		name: 'Overhead Pabrik',
		type: 'expense',
		isSystem: true,
		icon: 'Factory',
		color: '#eab308'
	},
	{
		code: '5201',
		name: 'Gaji Produksi',
		type: 'expense',
		isSystem: true,
		icon: 'Users',
		color: '#3b82f6'
	},
	{
		code: '5202',
		name: 'Gaji Admin',
		type: 'expense',
		isSystem: true,
		icon: 'UserCheck',
		color: '#6366f1'
	},
	{
		code: '5301',
		name: 'Listrik Pabrik',
		type: 'expense',
		isSystem: true,
		icon: 'Zap',
		color: '#eab308'
	},
	{
		code: '5302',
		name: 'Air Pabrik',
		type: 'expense',
		isSystem: true,
		icon: 'Droplets',
		color: '#0ea5e9'
	},
	{
		code: '5303',
		name: 'Bahan Bakar',
		type: 'expense',
		isSystem: false,
		icon: 'Fuel',
		color: '#f97316'
	},
	{
		code: '5401',
		name: 'Sewa Pabrik',
		type: 'expense',
		isSystem: false,
		icon: 'Building2',
		color: '#78716c'
	},
	{
		code: '5501',
		name: 'Perawatan Mesin',
		type: 'expense',
		isSystem: true,
		icon: 'Wrench',
		color: '#a8a29e'
	},
	{
		code: '5601',
		name: 'Iklan',
		type: 'expense',
		isSystem: false,
		icon: 'Megaphone',
		color: '#f43f5e'
	},
	{
		code: '5701',
		name: 'Transportasi',
		type: 'expense',
		isSystem: false,
		icon: 'Truck',
		color: '#6366f1'
	},
	{
		code: '5801',
		name: 'Penyusutan Mesin',
		type: 'expense',
		isSystem: true,
		icon: 'TrendingDown',
		color: '#6b7280'
	},
	{
		code: '5802',
		name: 'Penyusutan Gedung',
		type: 'expense',
		isSystem: false,
		icon: 'Building',
		color: '#9ca3af'
	},
	{
		code: '5901',
		name: 'Beban Lain',
		type: 'expense',
		isSystem: false,
		icon: 'MoreHorizontal',
		color: '#9ca3af'
	}
];

// ============================================================================
// Export all templates
// ============================================================================

export type BusinessType = 'warung_makan' | 'toko_kelontong' | 'jasa' | 'manufaktur';

export const accountTemplates: Record<BusinessType, AccountTemplate[]> = {
	warung_makan: warungMakanAccounts,
	toko_kelontong: tokoKelontongAccounts,
	jasa: jasaAccounts,
	manufaktur: manufakturAccounts
};

export const categoryTemplates: Record<BusinessType, CategoryTemplate[]> = {
	warung_makan: warungMakanCategories,
	toko_kelontong: tokoKelontongCategories,
	jasa: jasaCategories,
	manufaktur: manufakturCategories
};

// ============================================================================
// Transaction Templates - Default templates seeded based on business type
// ============================================================================

export const transactionTemplateData: Record<BusinessType, TransactionTemplateData[]> = {
	warung_makan: [
		{
			name: 'Penjualan Tunai',
			type: 'income',
			categoryName: 'Penjualan Makanan',
			description: 'Penjualan makanan secara tunai'
		},
		{
			name: 'Penjualan Minuman',
			type: 'income',
			categoryName: 'Penjualan Minuman',
			description: 'Penjualan minuman secara tunai'
		},
		{
			name: 'Beli Bahan Baku',
			type: 'expense',
			categoryName: 'Bahan Baku',
			description: 'Pembelian bahan baku masakan'
		},
		{ name: 'Bayar Sewa', type: 'expense', description: 'Pembayaran sewa tempat' },
		{ name: 'Bayar Supplier', type: 'expense', description: 'Pembayaran kepada supplier' }
	],
	toko_kelontong: [
		{
			name: 'Penjualan Tunai',
			type: 'income',
			categoryName: 'Penjualan Barang',
			description: 'Penjualan barang secara tunai'
		},
		{
			name: 'Penjualan Eceran',
			type: 'income',
			categoryName: 'Penjualan Eceran',
			description: 'Penjualan eceran'
		},
		{
			name: 'Beli Stok',
			type: 'expense',
			categoryName: 'Pembelian Stok',
			description: 'Pembelian stok barang dagangan'
		},
		{ name: 'Bayar Sewa', type: 'expense', description: 'Pembayaran sewa tempat' },
		{ name: 'Bayar Supplier', type: 'expense', description: 'Pembayaran kepada supplier' }
	],
	jasa: [
		{
			name: 'Penerimaan Jasa',
			type: 'income',
			categoryName: 'Pendapatan Jasa',
			description: 'Penerimaan pembayaran jasa'
		},
		{
			name: 'Uang Muka Client',
			type: 'income',
			categoryName: 'Uang Muka Client',
			description: 'Uang muka dari client'
		},
		{ name: 'Bayar Sewa', type: 'expense', description: 'Pembayaran sewa kantor/ruang kerja' },
		{ name: 'Bayar Supplier', type: 'expense', description: 'Pembayaran kepada supplier' },
		{ name: 'Biaya Operasional', type: 'expense', description: 'Biaya operasional usaha' }
	],
	manufaktur: [
		{
			name: 'Penjualan Produk',
			type: 'income',
			categoryName: 'Penjualan Produk',
			description: 'Penjualan produk jadi'
		},
		{
			name: 'Penjualan Sous',
			type: 'income',
			categoryName: 'Penjualan Sous',
			description: 'Penjualan bahan sampingan'
		},
		{
			name: 'Beli Bahan Mentah',
			type: 'expense',
			categoryName: 'Bahan Mentah',
			description: 'Pembelian bahan mentah'
		},
		{ name: 'Bayar Sewa', type: 'expense', description: 'Pembayaran sewa tempat' },
		{ name: 'Bayar Supplier', type: 'expense', description: 'Pembayaran kepada supplier' }
	]
};

/**
 * Get transaction templates by business type
 */
export function getTransactionTemplate(businessType: BusinessType): TransactionTemplateData[] {
	return transactionTemplateData[businessType] || [];
}

/**
 * Get template by business type
 */
export function getAccountTemplate(businessType: BusinessType): AccountTemplate[] {
	return accountTemplates[businessType] || [];
}

export function getCategoryTemplate(businessType: BusinessType): CategoryTemplate[] {
	return categoryTemplates[businessType] || [];
}

/**
 * Get all business types
 */
export function getBusinessTypes(): BusinessType[] {
	return ['warung_makan', 'toko_kelontong', 'jasa', 'manufaktur'];
}

/**
 * Get business type display names (Indonesian)
 */
export const businessTypeNames: Record<BusinessType, string> = {
	warung_makan: 'Warung Makan',
	toko_kelontong: 'Toko Kelontong',
	jasa: 'Jasa',
	manufaktur: 'Manufaktur'
};
