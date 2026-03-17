// ============================================================================
// Encryption Utilities for PII (NPWP)
// Uses Web Crypto API with AES-256-GCM for secure encryption
// Compatible with Cloudflare Workers environment
// ============================================================================

import { env } from '$env/dynamic/private';

function getEncryptionSecret(): string {
	const secret = env.NPWP_ENCRYPTION_KEY;
	if (!secret || secret.length < 32) {
		throw new Error(
			'NPWP_ENCRYPTION_KEY environment variable must be set (at least 32 characters)'
		);
	}
	return secret;
}

// Cached encryption key to avoid expensive recomputation
let cachedKey: Promise<CryptoKey> | null = null;

/**
 * Derive and cache a 32-byte key from the secret using SHA-256
 */
function deriveKey(): Promise<CryptoKey> {
	if (!cachedKey) {
		const encoder = new TextEncoder();
		const keyMaterial = encoder.encode(getEncryptionSecret());
		cachedKey = self.crypto.subtle
			.digest('SHA-256', keyMaterial)
			.then((hashedKey) =>
				self.crypto.subtle.importKey('raw', hashedKey, { name: 'AES-GCM', length: 256 }, false, [
					'encrypt',
					'decrypt'
				])
			);
	}
	return cachedKey;
}

/**
 * Encrypt NPWP for storage
 * @param npwp - Plain NPWP string (with or without dots/dashes)
 * @returns Base64 encoded encrypted string (IV + encrypted data)
 */
export async function encryptNPWP(npwp: string): Promise<string> {
	// Remove dots and dashes for consistent storage
	const cleanNpwp = npwp.replace(/[.-]/g, '');

	const key = await deriveKey();
	const iv = self.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

	const encoder = new TextEncoder();
	const encrypted = await self.crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, tagLength: 128 },
		key,
		encoder.encode(cleanNpwp)
	);

	// Combine IV + encrypted data
	const combined = new Uint8Array(iv.length + encrypted.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(encrypted), iv.length);

	// Convert to base64 - use binary string approach to avoid stack overflow
	let binary = '';
	const len = combined.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(combined[i]);
	}
	return btoa(binary);
}

/**
 * Decrypt NPWP from storage
 * @param encryptedNpwp - Base64 encoded encrypted string
 * @returns Decrypted NPWP string
 */
export async function decryptNPWP(encryptedNpwp: string): Promise<string | null> {
	if (!encryptedNpwp) return null;

	try {
		const key = await deriveKey();

		// Decode base64
		const combined = Uint8Array.from(atob(encryptedNpwp), (c) => c.charCodeAt(0));

		const iv = combined.slice(0, 12);
		const encrypted = combined.slice(12);

		const decrypted = await self.crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv, tagLength: 128 },
			key,
			encrypted
		);

		const decoder = new TextDecoder();
		return decoder.decode(decrypted);
	} catch {
		console.error('Failed to decrypt NPWP');
		return null;
	}
}

/**
 * Validate NPWP format
 * Valid formats: 15 or 16 digits (with or without dots/dashes)
 * Indonesian NPWP format: XX.XXX.XXX.X.XXX.XXX (15 digits) or XX.XXX.XXX.X.XX.XXX (16 digits)
 */
export function validateNPWP(npwp: string): { valid: boolean; error?: string } {
	if (!npwp) {
		return { valid: true }; // NPWP is optional
	}

	// Remove dots and dashes
	const cleanNpwp = npwp.replace(/[.-]/g, '');

	// Check if it's all digits
	if (!/^\d+$/.test(cleanNpwp)) {
		return { valid: false, error: 'NPWP harus berupa angka' };
	}

	// Check length: 15 or 16 digits
	if (cleanNpwp.length !== 15 && cleanNpwp.length !== 16) {
		return { valid: false, error: 'NPWP harus 15 atau 16 digit' };
	}

	return { valid: true };
}

/**
 * Format NPWP for display (add dots)
 * @param npwp - Clean NPWP string (digits only or with formatting)
 * @returns Formatted NPWP string
 */
export function formatNPWP(npwp: string): string {
	if (!npwp) return '';

	// Remove existing formatting
	const clean = npwp.replace(/[.-]/g, '');

	if (clean.length === 15) {
		// Format: XX.XXX.XXX.X.XXX.XXX
		return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}.${clean.slice(8, 9)}.${clean.slice(9, 12)}.${clean.slice(12)}`;
	} else if (clean.length === 16) {
		// Format: XX.XXX.XXX.X.XX.XXX
		return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}.${clean.slice(8, 9)}.${clean.slice(9, 11)}.${clean.slice(11)}`;
	}

	return npwp;
}
