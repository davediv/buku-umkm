/*
 * Receipt photos live in R2 under receipts/<userId>/<transactionId>/<objectId>.<jpg|png>.
 * The user prefix is what scopes an object to its owner: GET /api/photos refuses any key
 * outside the signed-in user's prefix, and every write or delete must check it too.
 */

export type ReceiptExtension = 'jpg' | 'png';

/** The longest file name kept for a receipt photo, in characters. */
export const MAX_PHOTO_FILE_NAME_LENGTH = 120;

const MAX_KEY_LENGTH = 512;

export function receiptPrefix(userId: string): string {
	return `receipts/${userId}/`;
}

export function receiptKey(
	userId: string,
	transactionId: string,
	objectId: string,
	extension: ReceiptExtension
): string {
	return `${receiptPrefix(userId)}${transactionId}/${objectId}.${extension}`;
}

/** The app URL that serves a receipt object (src/routes/api/photos/[...path]). */
export function receiptUrl(key: string): string {
	return `/api/photos/${key}`;
}

/**
 * True only for a key under the user's own prefix with no path tricks, so a stored or
 * uploaded key can never reach another user's objects.
 */
export function isOwnReceiptKey(userId: string, key: unknown): key is string {
	return (
		typeof key === 'string' &&
		key.length <= MAX_KEY_LENGTH &&
		key.startsWith(receiptPrefix(userId)) &&
		!key.includes('..') &&
		!key.includes('//') &&
		!key.includes('\\') &&
		!key.includes('\0')
	);
}

/** The image type a receipt key was written with, from its extension. */
export function receiptMimeType(key: string): 'image/jpeg' | 'image/png' | null {
	if (key.endsWith('.png')) return 'image/png';
	if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
	return null;
}

// Control characters, and the format characters (bidi overrides, zero-width marks) that
// can make a name display differently from what it is.
const INVISIBLE_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;

/**
 * The name to store for an uploaded or restored photo: the last path segment only,
 * without control or bidi characters, whitespace collapsed, and at most
 * MAX_PHOTO_FILE_NAME_LENGTH characters (counted by code point, so a surrogate pair is
 * never split). Falls back to `fallback` when nothing printable is left.
 */
export function sanitizePhotoFileName(value: unknown, fallback = 'foto'): string {
	if (typeof value !== 'string') return fallback;
	const lastSegment = value.split(/[/\\]/).pop() ?? '';
	const cleaned = lastSegment
		.normalize('NFC')
		.replace(INVISIBLE_CHARACTERS, '')
		.replace(/\s+/g, ' ')
		.trim();
	const name = Array.from(cleaned).slice(0, MAX_PHOTO_FILE_NAME_LENGTH).join('').trim();
	return name || fallback;
}
