import { describe, expect, it } from 'vitest';
import { getPasswordError } from './password';

describe('password policy', () => {
	it('accepts 8 to 128 characters with upper case, lower case and a digit', () => {
		expect(getPasswordError('Rahasia1')).toBeNull();
		expect(getPasswordError(`Aa1${'x'.repeat(125)}`)).toBeNull();
	});

	it.each([
		['', 'Kata sandi wajib diisi'],
		['Rahas1a', 'Kata sandi minimal 8 karakter'],
		[`Aa1${'x'.repeat(126)}`, 'Kata sandi maksimal 128 karakter'],
		['aaaaaaaa', 'Kata sandi harus mengandung huruf besar, huruf kecil, dan angka'],
		['rahasia123', 'Kata sandi harus mengandung huruf besar, huruf kecil, dan angka'],
		['RAHASIA123', 'Kata sandi harus mengandung huruf besar, huruf kecil, dan angka'],
		['RahasiaKu', 'Kata sandi harus mengandung huruf besar, huruf kecil, dan angka']
	])('rejects %j', (password, message) => {
		expect(getPasswordError(password)).toBe(message);
	});
});
