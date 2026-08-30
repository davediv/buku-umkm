const TRANSACTION_CREATE_PATH = '/transaksi/tambah';
const TRANSACTION_EDIT_PATH = /^\/transaksi\/[A-Za-z0-9_-]+$/;

export function getSafeTransactionReturn(value: string | null | undefined): string | null {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
		return null;
	}

	try {
		const parsed = new URL(value, 'https://buku-umkm.invalid');
		if (
			parsed.origin !== 'https://buku-umkm.invalid' ||
			(parsed.pathname !== TRANSACTION_CREATE_PATH && !TRANSACTION_EDIT_PATH.test(parsed.pathname))
		) {
			return null;
		}
		return `${parsed.pathname}${parsed.search}`;
	} catch {
		return null;
	}
}
