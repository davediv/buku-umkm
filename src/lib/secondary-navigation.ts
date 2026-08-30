import {
	Building2,
	Calculator,
	CreditCard,
	Database,
	FileQuestion,
	FileText,
	Info,
	Layers3,
	ShieldCheck,
	UserRound,
	Wallet
} from '@lucide/svelte';
import { getSettingsHref } from '$lib/settings-navigation';

export interface SecondaryNavigationItem {
	title: string;
	description: string;
	icon: typeof Building2;
	href: string;
}

export interface SecondaryNavigationGroup {
	label: string;
	items: SecondaryNavigationItem[];
}

export const secondaryNavigationGroups: SecondaryNavigationGroup[] = [
	{
		label: 'Profil bisnis',
		items: [
			{
				title: 'Profil Usaha',
				description: 'Identitas dan informasi usaha',
				icon: Building2,
				href: getSettingsHref('profil')
			},
			{
				title: 'Profil Pajak',
				description: 'Kelayakan dan pilihan rezim pajak',
				icon: Calculator,
				href: '/pajak/profil'
			}
		]
	},
	{
		label: 'Pembukuan',
		items: [
			{
				title: 'Kas & Rekening',
				description: 'Kelola sumber dana usaha',
				icon: Wallet,
				href: '/akun'
			},
			{
				title: 'Utang & Piutang',
				description: 'Pantau kewajiban dan tagihan',
				icon: CreditCard,
				href: '/hutang-piutang'
			},
			{
				title: 'Kategori',
				description: 'Atur pengelompokan transaksi',
				icon: Layers3,
				href: '/kategori'
			},
			{
				title: 'Template Transaksi',
				description: 'Kelola pencatatan berulang',
				icon: FileText,
				href: '/pengaturan/template'
			}
		]
	},
	{
		label: 'Akun & data',
		items: [
			{
				title: 'Akun Saya',
				description: 'Lihat identitas akun dan keluar',
				icon: UserRound,
				href: getSettingsHref('akun')
			},
			{
				title: 'Cadangkan & Pulihkan',
				description: 'Ekspor atau pulihkan data usaha',
				icon: Database,
				href: getSettingsHref('data')
			}
		]
	},
	{
		label: 'Informasi',
		items: [
			{
				title: 'Bantuan',
				description: 'Panduan penggunaan dan pemecahan masalah',
				icon: FileQuestion,
				href: '/bantuan'
			},
			{
				title: 'Privasi',
				description: 'Cara data Anda digunakan dan disimpan',
				icon: ShieldCheck,
				href: '/privasi'
			},
			{
				title: 'Tentang Buku UMKM',
				description: 'Tujuan, fitur, dan versi aplikasi',
				icon: Info,
				href: '/tentang'
			}
		]
	}
];

export const secondaryNavigationItems = secondaryNavigationGroups.flatMap((group) => group.items);
