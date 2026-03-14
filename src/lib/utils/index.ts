import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BUSINESS_TYPES } from '$lib/constants';
import { INDONESIAN_MONTHS } from '$lib/tax/config';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Get business type label from business type value
 */
export function getBusinessTypeLabel(type: string): string {
	return BUSINESS_TYPES.find((bt) => bt.value === type)?.label ?? type;
}

// ============================================================================
// Currency Formatting
// ============================================================================

// Re-export canonical formatRupiah from tax engine
export { formatRupiah } from '$lib/tax/engine';

/**
 * Format a number as Indonesian Rupiah (plain number, no "Rp" prefix)
 */
export function formatIdr(amount: number | string): string {
	const num = typeof amount === 'string' ? parseInt(amount.replace(/\D/g, ''), 10) : amount;
	if (isNaN(num)) return '0';
	return num.toLocaleString('id-ID');
}

/**
 * Format amount with + or - prefix based on transaction type
 */
export function formatTransactionAmount(amount: number, type: 'income' | 'expense'): string {
	const formatted = amount.toLocaleString('id-ID');
	return type === 'income' ? `+${formatted}` : `-${formatted}`;
}

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format date string to short format: "5 Mar 2025"
 */
export function formatDate(dateStr: string | null): string {
	if (!dateStr) return '-';
	return new Date(dateStr).toLocaleDateString('id-ID', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}

/**
 * Format date string to short format without year: "5 Mar"
 */
export function formatDateShort(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString('id-ID', {
		day: 'numeric',
		month: 'short'
	});
}

/**
 * Format date string to long Indonesian format: "5 Maret 2025"
 * Uses manual parsing to avoid timezone issues with date-only strings
 */
export function formatDateLong(dateStr: string): string {
	const dateOnly = dateStr.split('T')[0];
	const [year, month, day] = dateOnly.split('-').map(Number);
	return `${day} ${INDONESIAN_MONTHS[month - 1]} ${year}`;
}

/**
 * Format date string with time: "5 Maret 2025 pukul 10.30"
 */
export function formatDateTime(dateString: string | null): string {
	if (!dateString) return '-';
	return new Date(dateString).toLocaleDateString('id-ID', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Format date string to DD/MM/YYYY: "05/03/2025"
 */
export function formatDateSlash(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString('id-ID', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
}

// ============================================================================
// Status Badge Utilities
// ============================================================================

/**
 * Get debt status badge label and class
 */
export function getDebtStatusBadge(status: string): { label: string; class: string } {
	switch (status) {
		case 'active':
			return { label: 'Aktif', class: 'bg-blue-100 text-blue-700' };
		case 'paid':
			return { label: 'Lunas', class: 'bg-green-100 text-green-700' };
		case 'overdue':
			return { label: 'Jatuh Tempo', class: 'bg-red-100 text-red-700' };
		default:
			return { label: status, class: 'bg-gray-100 text-gray-700' };
	}
}

// ============================================================================
// Report Utilities
// ============================================================================

/**
 * Get comparison text for period-over-period changes
 */
export function getComparisonText(change: number): { text: string; isPositive: boolean } {
	const absChange = Math.abs(change);
	if (change > 0) return { text: `Naik ${absChange.toFixed(1)}%`, isPositive: true };
	else if (change < 0) return { text: `Turun ${absChange.toFixed(1)}%`, isPositive: false };
	return { text: 'Tidak berubah', isPositive: true };
}

/**
 * Get maximum category value for chart scaling
 */
export function getMaxCategoryValue(categories: { total: number }[]): number {
	return Math.max(...categories.map((c) => c.total), 1);
}

// ============================================================================
// Image Utilities
// ============================================================================

/**
 * Compress an image file to reduce its size
 * @param file - The image file to compress
 * @param maxDim - Maximum dimension (width or height) - defaults to 1200
 * @param maxSizeKB - Maximum file size in KB - defaults to 500
 * @returns Compressed image as a File object
 */
export async function compressImage(file: File, maxDim = 1200, maxSizeKB = 500): Promise<File> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				let width = img.width;
				let height = img.height;

				// Scale down if too large
				if (width > maxDim || height > maxDim) {
					if (width > height) {
						height = (height / width) * maxDim;
						width = maxDim;
					} else {
						width = (width / height) * maxDim;
						height = maxDim;
					}
				}

				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					reject(new Error('Could not get canvas context'));
					return;
				}
				ctx.drawImage(img, 0, 0, width, height);

				// Try to compress to under maxSizeKB
				let quality = 0.8;
				let result = canvas.toDataURL('image/jpeg', quality);

				// Reduce quality until under target size
				// Base64 length ≈ 1.37x actual binary size
				while (result.length > maxSizeKB * 1024 * 1.37 && quality > 0.3) {
					quality -= 0.1;
					result = canvas.toDataURL('image/jpeg', quality);
				}

				// Convert base64 to blob
				const base64 = result.split(',')[1];
				const binaryString = atob(base64);
				const bytes = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}
				const blob = new Blob([bytes], { type: 'image/jpeg' });
				const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', {
					type: 'image/jpeg'
				});
				resolve(compressedFile);
			};
			img.onerror = reject;
			img.src = e.target?.result as string;
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
