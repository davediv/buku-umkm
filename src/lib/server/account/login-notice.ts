/**
 * Messages the /masuk page shows when another flow sends the user there, as `?info=<key>`.
 * Only these keys are shown, so the URL cannot put arbitrary text on the login page.
 */
const LOGIN_NOTICES = {
	'kata-sandi-diubah': 'Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.'
} as const;

export type LoginNotice = keyof typeof LOGIN_NOTICES;

export function loginNoticeHref(notice: LoginNotice): string {
	return `/masuk?info=${notice}`;
}

export function getLoginNotice(key: string | null): string | null {
	return key && Object.hasOwn(LOGIN_NOTICES, key) ? LOGIN_NOTICES[key as LoginNotice] : null;
}
