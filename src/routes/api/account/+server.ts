import { APIError } from 'better-auth/api';
import type { RequestHandler } from './$types';
import { RECEIPTS_NOT_DELETED } from '#lib/server/account/deletion.ts';
import { getAuth } from '#lib/server/auth.ts';
import { summarizeError } from '#lib/server/error-summary.ts';
import {
	CREDENTIAL_RATE_LIMIT_MESSAGE,
	isCredentialAttemptAllowed,
	tooManyRequests
} from '#lib/server/security/rate-limit.ts';

/** The word the user types to confirm, as shown in Pengaturan > Hapus akun. */
const CONFIRMATION_WORD = 'HAPUS';

type Field = 'password' | 'confirmation';

function refuse(status: number, error: string, field?: Field) {
	return Response.json(field ? { error, field } : { error }, { status });
}

/**
 * DELETE /api/account: permanently deletes the signed-in user's account, all of their books and
 * their receipt photos, and signs them out (better-auth's delete-user, see
 * $lib/server/account/deletion). Body: { password, confirmation: "HAPUS" }.
 */
export const DELETE: RequestHandler = async (event) => {
	const { locals, request } = event;
	if (!locals.user || !locals.session) {
		return refuse(401, 'Sesi berakhir. Silakan masuk kembali.');
	}

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const password = typeof body?.password === 'string' ? body.password : '';
	const confirmation = typeof body?.confirmation === 'string' ? body.confirmation : '';

	if (confirmation.trim().toUpperCase() !== CONFIRMATION_WORD) {
		return refuse(400, `Ketik ${CONFIRMATION_WORD} untuk mengonfirmasi.`, 'confirmation');
	}
	if (!password) return refuse(400, 'Kata sandi wajib diisi', 'password');

	if (!(await isCredentialAttemptAllowed(event, locals.user.email))) {
		return tooManyRequests(CREDENTIAL_RATE_LIMIT_MESSAGE);
	}

	try {
		// Checks the password, deletes R2 photos then the user (D1 cascades to every business
		// table), revokes all sessions and expires this browser's session cookies.
		await getAuth().api.deleteUser({ body: { password }, headers: request.headers });
	} catch (cause) {
		const code = cause instanceof APIError ? cause.body?.code : undefined;
		if (code === 'INVALID_PASSWORD') return refuse(400, 'Kata sandi salah', 'password');
		if (code === RECEIPTS_NOT_DELETED && cause instanceof APIError) {
			return refuse(503, cause.message);
		}
		console.error('Account deletion failed', summarizeError(cause));
		return refuse(500, 'Akun belum dihapus karena terjadi kesalahan server. Coba lagi.');
	}

	return Response.json({ success: true });
};
