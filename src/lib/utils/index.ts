import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BUSINESS_TYPES } from '$lib/constants';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Get business type label from business type value
 */
export function getBusinessTypeLabel(type: string): string {
	return BUSINESS_TYPES.find((bt) => bt.value === type)?.label ?? type;
}

/**
 * Format a number as Indonesian Rupiah
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
