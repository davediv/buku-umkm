import { redirect } from '@sveltejs/kit';
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
		} catch {
			npwp = '';
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
