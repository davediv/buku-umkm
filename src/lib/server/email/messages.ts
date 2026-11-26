/**
 * The account emails, in Indonesian, as plain text plus a simple HTML version.
 *
 * They greet the reader without a name on purpose: the name is whatever was typed at sign-up,
 * and anyone can sign up with someone else's address, so using it would let a stranger put
 * their own words into mail sent from this app's domain.
 */

export type EmailKind = 'password-reset' | 'email-verification';

export interface EmailMessage {
	/** For logs: which message failed, without saying to whom. */
	kind: EmailKind;
	subject: string;
	text: string;
	html: string;
}

interface Template {
	kind: EmailKind;
	subject: string;
	intro: string;
	actionLabel: string;
	url: string;
	notes: string[];
}

const BRAND_COLOR = '#a5411d';
const MUTED_COLOR = '#6b7280';

const HTML_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function compose({ kind, subject, intro, actionLabel, url, notes }: Template): EmailMessage {
	const text = [
		'Halo,',
		intro,
		url,
		...notes,
		'Salam,\nTim Buku UMKM',
		'Email ini dikirim otomatis. Mohon tidak membalas email ini.'
	].join('\n\n');

	const href = escapeHtml(url);
	const paragraph = (content: string, style = '') =>
		`<p style="margin:0 0 16px;line-height:1.5;${style}">${content}</p>`;
	const html = [
		'<!doctype html>',
		'<html lang="id">',
		'<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>',
		'<body style="margin:0;padding:24px 12px;background:#f6f4f1;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;">',
		'<div style="max-width:480px;margin:0 auto;padding:24px;background:#ffffff;border-radius:12px;">',
		paragraph('Buku UMKM', `font-size:18px;font-weight:bold;color:${BRAND_COLOR};`),
		paragraph('Halo,'),
		paragraph(escapeHtml(intro)),
		`<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;padding:12px 20px;background:${BRAND_COLOR};color:#ffffff;border-radius:8px;font-weight:bold;text-decoration:none;">${escapeHtml(actionLabel)}</a></p>`,
		paragraph(
			`Jika tombol tidak dapat dibuka, salin tautan berikut ke browser Anda:<br><a href="${href}" style="color:${BRAND_COLOR};word-break:break-all;">${href}</a>`,
			`font-size:13px;color:${MUTED_COLOR};`
		),
		...notes.map((note) => paragraph(escapeHtml(note))),
		paragraph('Salam,<br>Tim Buku UMKM'),
		paragraph(
			'Email ini dikirim otomatis. Mohon tidak membalas email ini.',
			`margin:0;font-size:12px;color:${MUTED_COLOR};`
		),
		'</div>',
		'</body>',
		'</html>'
	].join('\n');

	return { kind, subject, text, html };
}

function hours(seconds: number): string {
	return `${Math.max(1, Math.round(seconds / 3600))} jam`;
}

/** The link in the password reset email; `validForSeconds` is the token lifetime. */
export function passwordResetEmail(url: string, validForSeconds: number): EmailMessage {
	return compose({
		kind: 'password-reset',
		subject: 'Atur ulang kata sandi Buku UMKM',
		intro:
			'Kami menerima permintaan untuk mengatur ulang kata sandi akun Buku UMKM Anda. Buka tautan di bawah ini untuk membuat kata sandi baru.',
		actionLabel: 'Buat kata sandi baru',
		url,
		notes: [
			`Tautan ini berlaku selama ${hours(validForSeconds)} dan hanya dapat dipakai sekali. Setelah kata sandi diganti, akun Anda akan dikeluarkan dari semua perangkat.`,
			'Jika Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini. Kata sandi Anda tidak berubah.'
		]
	});
}

/** The link in the email address verification email; `validForSeconds` is the token lifetime. */
export function verificationEmail(url: string, validForSeconds: number): EmailMessage {
	return compose({
		kind: 'email-verification',
		subject: 'Verifikasi email akun Buku UMKM',
		intro:
			'Terima kasih telah menggunakan Buku UMKM. Buka tautan di bawah ini untuk memastikan alamat email ini milik Anda, agar Anda dapat mengatur ulang kata sandi jika lupa.',
		actionLabel: 'Verifikasi email',
		url,
		notes: [
			`Tautan ini berlaku selama ${hours(validForSeconds)}. Jika sudah kedaluwarsa, kirim ulang email verifikasi dari menu Pengaturan > Akun Saya.`,
			'Jika Anda tidak membuat akun Buku UMKM, abaikan email ini.'
		]
	});
}
