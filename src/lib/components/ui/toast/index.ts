/**
 * Toast store for managing toast notifications
 */
import { writable } from 'svelte/store';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';

export interface Toast {
	id: string;
	title: string;
	description?: string;
	variant: ToastVariant;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	function addToast(toast: Omit<Toast, 'id'>) {
		const id = Math.random().toString(36).substring(2, 9);
		const newToast: Toast = { ...toast, id };

		update((toasts) => [...toasts, newToast]);

		// Auto-remove after 2 seconds
		setTimeout(() => {
			removeToast(id);
		}, 2000);

		return id;
	}

	function removeToast(id: string) {
		update((toasts) => toasts.filter((t) => t.id !== id));
	}

	return {
		subscribe,
		show: addToast,
		remove: removeToast,
		success: (title: string, description?: string) =>
			addToast({ title, description, variant: 'success' }),
		error: (title: string, description?: string) =>
			addToast({ title, description, variant: 'error' }),
		warning: (title: string, description?: string) =>
			addToast({ title, description, variant: 'warning' }),
		info: (title: string, description?: string) =>
			addToast({ title, description, variant: 'default' })
	};
}

export const toast = createToastStore();

export function copyToast(fieldName: string) {
	toast.success('Berhasil disalin', `${fieldName} telah disalin ke clipboard`);
}
