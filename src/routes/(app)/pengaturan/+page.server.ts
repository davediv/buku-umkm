import { error as httpError, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { businessProfileQueries } from '$lib/server/db/queries';
import { decryptNPWP, formatNPWP } from '$lib/server/crypto';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const db = getDb();
	const userId = locals.user.id;

	// Get business profile
	let profile = null;
	try {
		profile = await businessProfileQueries.findByUserId(db, userId);
	} catch (cause) {
		console.error('Error fetching profile', cause);
		throw httpError(500, 'Profil usaha tidak dapat dimuat. Data Anda tidak diubah.');
	}

	// Decrypt NPWP for display
	let displayNpwp: string | null = null;
	if (profile?.npwp) {
		try {
			const decrypted = await decryptNPWP(profile.npwp);
			displayNpwp = decrypted ? formatNPWP(decrypted) : null;
		} catch (cause) {
			console.error('Error decrypting NPWP', cause);
			throw httpError(500, 'NPWP tidak dapat dimuat dengan aman. Data Anda tidak diubah.');
		}
	}

	return {
		user: {
			email: locals.user.email
		},
		profile: profile
			? {
					id: profile.id,
					name: profile.name,
					businessType: profile.businessType,
					address: profile.address,
					phone: profile.phone,
					npwp: displayNpwp,
					ownerName: profile.ownerName,
					industry: profile.industry
				}
			: null
	};
};
