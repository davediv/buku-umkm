import { describe, expect, it } from 'vitest';
import { passwordResetEmail, verificationEmail } from './messages';

const RESET_URL = 'https://buku.test/atur-ulang-kata-sandi?token=abc123&x=<y>';

describe('account email messages', () => {
	it('builds the password reset email in Indonesian with the link in both parts', () => {
		const message = passwordResetEmail(RESET_URL, 3600);

		expect(message.kind).toBe('password-reset');
		expect(message.subject).toBe('Atur ulang kata sandi Buku UMKM');
		expect(message.text).toContain('mengatur ulang kata sandi');
		expect(message.text).toContain(RESET_URL);
		expect(message.text).toContain('berlaku selama 1 jam');
		expect(message.text).toContain('dikeluarkan dari semua perangkat');
		expect(message.html).toContain('<html lang="id">');
		expect(message.html).toContain('Buat kata sandi baru');
		expect(message.html).toContain('berlaku selama 1 jam');
	});

	it('escapes the link in the HTML part', () => {
		const { html } = passwordResetEmail(RESET_URL, 3600);

		expect(html).toContain(
			'href="https://buku.test/atur-ulang-kata-sandi?token=abc123&amp;x=&lt;y&gt;"'
		);
		expect(html).not.toContain('<y>');
	});

	it('builds the verification email with its own lifetime and resend hint', () => {
		const url = 'https://buku.test/verifikasi-email?token=jwt.token.value';
		const message = verificationEmail(url, 24 * 3600);

		expect(message.kind).toBe('email-verification');
		expect(message.subject).toBe('Verifikasi email akun Buku UMKM');
		expect(message.text).toContain(url);
		expect(message.text).toContain('berlaku selama 24 jam');
		expect(message.text).toContain('Pengaturan > Akun Saya');
		expect(message.html).toContain(`href="${url}"`);
		expect(message.html).toContain('Verifikasi email');
	});

	it('greets without a name, so sign-up input never reaches the mail', () => {
		for (const message of [passwordResetEmail(RESET_URL, 3600), verificationEmail(RESET_URL, 60)]) {
			expect(message.text.startsWith('Halo,\n\n')).toBe(true);
			expect(message.html).toContain('>Halo,</p>');
		}
	});
});
