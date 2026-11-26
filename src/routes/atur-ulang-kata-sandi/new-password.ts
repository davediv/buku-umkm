import { getPasswordError } from '$lib/shared/password';

export interface NewPasswordErrors {
	password?: string;
	confirmPassword?: string;
}

/** The checks the reset form makes in the browser and again in its action. */
export function validateNewPassword(password: string, confirmPassword: string): NewPasswordErrors {
	const errors: NewPasswordErrors = {};
	const passwordError = getPasswordError(password);
	if (passwordError) errors.password = passwordError;
	if (!confirmPassword) {
		errors.confirmPassword = 'Konfirmasi kata sandi wajib diisi';
	} else if (password !== confirmPassword) {
		errors.confirmPassword = 'Kata sandi dan konfirmasi tidak cocok';
	}
	return errors;
}
