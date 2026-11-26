/**
 * Due date for paying PPh Final UMKM (PPh Pasal 4 ayat (2)) of a tax month: the 15th of the
 * following month (PMK 81/2024 Pasal 94 ayat (2) huruf a).
 */
export function paymentDueDate(year: number, month: number): string {
	const dueYear = month === 12 ? year + 1 : year;
	const dueMonth = month === 12 ? 1 : month + 1;
	return `${dueYear}-${String(dueMonth).padStart(2, '0')}-15`;
}

/** Whole days from `from` to `to` (both ISO dates); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
	const start = Date.parse(`${from}T00:00:00Z`);
	const end = Date.parse(`${to}T00:00:00Z`);
	return Math.round((end - start) / 86_400_000);
}
