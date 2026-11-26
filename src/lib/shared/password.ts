/**
 * The one password policy for every path that sets a password: the /daftar form and
 * better-auth's own endpoints (see src/lib/server/security/password-policy.ts).
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Returns the Indonesian message for a password that breaks the policy, or null if it passes. */
export function getPasswordError(password: string): string | null {
	if (!password) return 'Kata sandi wajib diisi';
	if (password.length < PASSWORD_MIN_LENGTH) {
		return `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter`;
	}
	if (password.length > PASSWORD_MAX_LENGTH) {
		return `Kata sandi maksimal ${PASSWORD_MAX_LENGTH} karakter`;
	}
	if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
		return 'Kata sandi harus mengandung huruf besar, huruf kecil, dan angka';
	}
	return null;
}
