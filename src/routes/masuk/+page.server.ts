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
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		// Client-side validation
		const errors: Record<string, string> = {};

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

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, email, values: { email } });
		}

		const auth = getAuth();
		try {
			await auth.api.signInEmail({
				body: {
					email,
					password,
					callbackURL: '/beranda'
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: 'Email atau kata sandi salah', values: { email } });
			}
			return fail(500, { message: 'Terjadi kesalahan server', values: { email } });
		}

		return redirect(302, '/beranda');
	}
};
