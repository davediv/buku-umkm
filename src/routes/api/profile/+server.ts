import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { businessProfileQueries } from '$lib/server/db/queries';
import { encryptNPWP, decryptNPWP, validateNPWP, formatNPWP } from '$lib/server/crypto';
import type { businessProfile } from '$lib/server/db/schema';

interface UpdateProfileBody {
	name?: string;
	businessType?: string;
	address?: string;
	phone?: string;
	npwp?: string;
	ownerName?: string;
	industry?: string;
}

// Valid business types
const VALID_BUSINESS_TYPES = [
	'warung_makan',
	'toko_kelontong',
	'jasa',
	'manufaktur',
	'toko_online',
	'lainnya'
] as const;

/**
 * Format profile NPWP for display (decrypt and format)
 */
async function formatProfileNpwp(encryptedNpwp: string | null): Promise<string | null> {
	if (!encryptedNpwp) return null;
	const decrypted = await decryptNPWP(encryptedNpwp);
	return decrypted ? formatNPWP(decrypted) : null;
}

/**
 * Serialize profile for API response
 */
async function serializeProfile(
	profile: typeof businessProfile.$inferSelect
): Promise<Record<string, unknown>> {
	const displayNpwp = await formatProfileNpwp(profile.npwp);

	return {
		id: profile.id,
		name: profile.name,
		businessType: profile.businessType,
		address: profile.address,
		phone: profile.phone,
		npwp: displayNpwp,
		ownerName: profile.ownerName,
		industry: profile.industry,
		createdAt: profile.createdAt,
		updatedAt: profile.updatedAt
	};
}

// GET /api/profile - Returns business profile for authenticated user
export const GET: RequestHandler = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		const profile = await businessProfileQueries.findByUserId(db, userId);

		if (!profile) {
			return json({ error: 'Profil usaha tidak ditemukan' }, { status: 404 });
		}

		const serializedProfile = await serializeProfile(profile);

		return json({ profile: serializedProfile });
	} catch {
		console.error('Error fetching profile:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// PUT /api/profile - Updates business profile
export const PUT: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	try {
		const body = (await request.json()) as UpdateProfileBody;

		const db = getDb();

		// Check if profile exists
		const existingProfile = await businessProfileQueries.findByUserId(db, userId);

		if (!existingProfile) {
			return json({ error: 'Profil usaha tidak ditemukan' }, { status: 404 });
		}

		// Validate name (required if being updated)
		if (body.name !== undefined && (!body.name || body.name.trim() === '')) {
			return json({ error: 'Nama usaha wajib diisi' }, { status: 400 });
		}

		// Validate business type
		if (body.businessType !== undefined) {
			if (
				!VALID_BUSINESS_TYPES.includes(body.businessType as (typeof VALID_BUSINESS_TYPES)[number])
			) {
				return json(
					{
						error: `Jenis usaha tidak valid. Jenis yang diperbolehkan: ${VALID_BUSINESS_TYPES.join(', ')}`
					},
					{ status: 400 }
				);
			}
		}

		// Validate NPWP format if provided
		if (body.npwp !== undefined && body.npwp !== '') {
			const npwpValidation = validateNPWP(body.npwp);
			if (!npwpValidation.valid) {
				return json({ error: npwpValidation.error }, { status: 400 });
			}
		}

		// Prepare update data
		const updateData: {
			name?: string;
			businessType?: string;
			address?: string | null;
			phone?: string | null;
			npwp?: string | null;
			ownerName?: string | null;
			industry?: string | null;
		} = {};

		if (body.name !== undefined) {
			updateData.name = body.name.trim();
		}
		if (body.businessType !== undefined) {
			updateData.businessType = body.businessType;
		}
		if (body.address !== undefined) {
			updateData.address = body.address?.trim() ?? null;
		}
		if (body.phone !== undefined) {
			updateData.phone = body.phone?.trim() ?? null;
		}
		if (body.npwp !== undefined) {
			// Encrypt NPWP before storing
			if (body.npwp && body.npwp.trim() !== '') {
				updateData.npwp = await encryptNPWP(body.npwp);
			} else {
				updateData.npwp = null;
			}
		}
		if (body.ownerName !== undefined) {
			updateData.ownerName = body.ownerName?.trim() ?? null;
		}
		if (body.industry !== undefined) {
			updateData.industry = body.industry?.trim() ?? null;
		}

		// Update profile
		await businessProfileQueries.update(db, userId, updateData);

		// Merge existing profile with update data for response (avoid extra DB query)
		const updatedProfile = {
			...existingProfile,
			...updateData,
			updatedAt: new Date()
		};

		const serializedProfile = await serializeProfile(updatedProfile);

		return json({
			message: 'Profil berhasil diperbarui',
			profile: serializedProfile
		});
	} catch {
		console.error('Error updating profile:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
