import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
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
