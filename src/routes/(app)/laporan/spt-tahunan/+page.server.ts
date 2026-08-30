import { error as httpError, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { businessProfileQueries } from '$lib/server/db/queries';
import { decryptNPWP, formatNPWP } from '$lib/server/crypto';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.session) throw redirect(302, '/masuk');

	const profile = await businessProfileQueries.findByUserId(getDb(), locals.user.id);
	let npwp = '';
	if (profile?.npwp) {
		try {
			const decrypted = await decryptNPWP(profile.npwp);
			npwp = decrypted ? formatNPWP(decrypted) : '';
		} catch (cause) {
			console.error('Error decrypting NPWP for annual tax report', cause);
			throw httpError(500, 'NPWP tidak dapat dimuat dengan aman. Data Anda tidak diubah.');
		}
	}

	return {
		businessProfile: profile
			? {
					name: profile.name,
					address: profile.address ?? '',
					npwp,
					ownerName: profile.ownerName ?? ''
				}
			: null
	};
};
