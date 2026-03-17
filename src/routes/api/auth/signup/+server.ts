import { getAuth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface SignUpBody {
	email: string;
	password: string;
	name?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const auth = getAuth();

	try {
		const body = (await request.json()) as SignUpBody;
		const email = body.email;
		const password = body.password;
		const name = body.name;

		// Validate required fields
		if (!email || !password) {
			return json({ error: 'Email dan password wajib diisi' }, { status: 400 });
		}

		// Validate password strength
		if (password.length < 8) {
			return json({ error: 'Password minimal 8 karakter' }, { status: 400 });
		}

		if (password.length > 128) {
			return json({ error: 'Password maksimal 128 karakter' }, { status: 400 });
		}

		if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
			return json(
				{ error: 'Password harus mengandung huruf besar, huruf kecil, dan angka' },
				{ status: 400 }
			);
		}

		// Sign up the user
		const result = await auth.api.signUpEmail({
			body: {
				email,
				password,
				name: name || email.split('@')[0]
			}
		});

		// Extract session from the result - better-auth returns session in different ways
		const session =
			'session' in result ? result.session : { token: result.token, user: result.user };

		return json({
			message: 'Pendaftaran berhasil',
			user: result.user,
			session
		});
	} catch (error) {
		if (error instanceof APIError) {
			// Handle duplicate email error
			if (
				error.message?.toLowerCase().includes('email') &&
				error.message?.toLowerCase().includes('exist')
			) {
				return json({ error: 'Email sudah terdaftar' }, { status: 400 });
			}
			return json({ error: 'Pendaftaran gagal' }, { status: 400 });
		}

		console.error('Signup error');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
