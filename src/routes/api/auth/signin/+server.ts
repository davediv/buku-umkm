import { getAuth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface SignInBody {
	email: string;
	password: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const auth = getAuth();

	try {
		const body = (await request.json()) as SignInBody;
		const email = body.email;
		const password = body.password;

		// Validate required fields
		if (!email || !password) {
			return json({ error: 'Email dan password wajib diisi' }, { status: 400 });
		}

		// Sign in the user
		const result = await auth.api.signInEmail({
			body: {
				email,
				password
			}
		});

		// Extract session from the result - better-auth returns session in different ways
		const session =
			'session' in result ? result.session : { token: result.token, user: result.user };

		return json({
			message: 'Login berhasil',
			user: result.user,
			session
		});
	} catch (error) {
		if (error instanceof APIError) {
			return json({ error: 'Email atau password salah' }, { status: 401 });
		}

		console.error('Signin error');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
