// Transaction-related constants
export const MAX_TRANSACTION_AMOUNT = 999_999_999_999;

// App version for backup metadata
export const APP_VERSION = '0.0.1';

// Backup schema version
export const BACKUP_SCHEMA_VERSION = '1.0.0';

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
