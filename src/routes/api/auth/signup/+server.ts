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

		// Validate password minimum length (8 characters)
		if (password.length < 8) {
			return json({ error: 'Password minimal 8 karakter' }, { status: 400 });
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
			return json({ error: error.message || 'Pendaftaran gagal' }, { status: 400 });
		}

		console.error('Signup error:', error);
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
