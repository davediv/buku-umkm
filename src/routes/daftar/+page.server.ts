import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAuth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/beranda');
	}
	return {};
};

export const actions: Actions = {
	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString() ?? '';
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

		// Client-side validation
		const errors: Record<string, string> = {};

		if (!name) {
			errors.name = 'Nama wajib diisi';
		}

		if (!email) {
			errors.email = 'Email wajib diisi';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			errors.email = 'Email tidak valid';
		}

		if (!password) {
			errors.password = 'Kata sandi wajib diisi';
		} else if (password.length < 8) {
			errors.password = 'Kata sandi minimal 8 karakter';
		}

		if (!confirmPassword) {
			errors.confirmPassword = 'Konfirmasi kata sandi wajib diisi';
		} else if (password !== confirmPassword) {
			errors.confirmPassword = 'Kata sandi dan konfirmasi tidak cocok';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { name, email } });
		}

		const auth = getAuth();
		try {
			await auth.api.signUpEmail({
				body: {
					email,
					password,
					name,
					callbackURL: '/beranda'
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, {
					message: error.message || 'Pendaftaran gagal',
					values: { name, email }
				});
			}
			return fail(500, { message: 'Terjadi kesalahan server', values: { name, email } });
		}

		// Redirect to onboarding after successful registration
		return redirect(302, '/onboarding');
	}
};
