// Transaction-related constants
export const MAX_TRANSACTION_AMOUNT = 999_999_999_999;

// App version for backup metadata
export const APP_VERSION = '0.0.1';

// The largest backup file restore accepts (checked in the browser and on the server).
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

// The largest .zip backup restore takes in one request, photos included. Cloudflare
// refuses request bodies over 100 MB on Free and Pro zones before the Worker runs.
export const MAX_BACKUP_ARCHIVE_BYTES = 95 * 1024 * 1024;

// The first entry of a .zip backup: the backup document itself.
export const BACKUP_DOCUMENT_ENTRY = 'backup.json';

// Business types
export const BUSINESS_TYPES = [
	{ value: 'warung_makan', label: 'Warung Makan/Restoran' },
	{ value: 'toko_kelontong', label: 'Toko Kelontong' },
	{ value: 'jasa', label: 'Jasa' },
	{ value: 'manufaktur', label: 'Manufaktur' },
	{ value: 'toko_online', label: 'Toko Online' },
	{ value: 'lainnya', label: 'Lainnya' }
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]['value'];

/** The display label of a stored business type, or "UMKM" when it is unset or "lainnya". */
export function businessTypeLabel(value: string | null | undefined): string {
	if (!value || value === 'lainnya') return 'UMKM';
	return BUSINESS_TYPES.find((type) => type.value === value)?.label ?? 'UMKM';
}
