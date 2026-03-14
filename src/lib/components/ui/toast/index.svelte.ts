/**
 * Toast store for managing toast notifications (Svelte 5 runes)
 */
import { SvelteMap } from 'svelte/reactivity';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';

export interface Toast {
	id: string;
	title: string;
	description?: string;
	variant: ToastVariant;
}

let toasts = $state<Toast[]>([]);
const timers = new SvelteMap<string, ReturnType<typeof setTimeout>>();

function addToast(t: Omit<Toast, 'id'>) {
	const id = crypto.randomUUID();
	const newToast: Toast = { ...t, id };

	toasts = [...toasts, newToast];

	// Auto-remove after 2 seconds
	const timer = setTimeout(() => {
		timers.delete(id);
		removeToast(id);
	}, 2000);
	timers.set(id, timer);

	return id;
}

function removeToast(id: string) {
	const timer = timers.get(id);
	if (timer) {
		clearTimeout(timer);
		timers.delete(id);
	}
	toasts = toasts.filter((t) => t.id !== id);
}

export const toast = {
	get items() {
		return toasts;
	},
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

export function copyToast(fieldName: string) {
	toast.success('Berhasil disalin', `${fieldName} telah disalin ke clipboard`);
}
