import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { chartOfAccountQueries } from '#lib/server/db/queries/index.ts';
import { deactivateAccount, type AccountDeactivation } from '#lib/server/finance/accounts.ts';
import {
	VALID_ACCOUNT_TYPES,
	isValidAccountType,
	mapAccountType,
	mapSchemaToApiType,
	parseAccountName
} from '#lib/shared/account-types.ts';
import { summarizeError } from '#lib/server/error-summary.ts';

const DEACTIVATION_ERRORS: Record<Exclude<AccountDeactivation, 'deactivated'>, [string, number]> = {
	not_found: ['Akun tidak ditemukan', 404],
	already_inactive: ['Akun sudah dinonaktifkan', 400],
	has_balance: [
		'Akun yang masih memiliki saldo tidak dapat dinonaktifkan, agar saldonya tetap tercatat di laporan.',
		400
	],
	has_transactions: ['Akun yang memiliki transaksi terkait belum dapat dinonaktifkan.', 400]
};

// GET /api/accounts/[id] - Get a single account (not in original requirements but useful)
export const GET: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const accountId = params.id;

	if (!accountId) {
		return json({ error: 'ID akun diperlukan' }, { status: 400 });
	}

	const db = getDb();

	try {
		const account = await chartOfAccountQueries.findById(db, userId, accountId);

		if (!account) {
			return json({ error: 'Akun tidak ditemukan' }, { status: 404 });
		}

		return json({
			account: {
				id: account.id,
				name: account.name,
				type: mapSchemaToApiType(account.subType),
				balance: account.balance,
				code: account.code,
				isActive: account.isActive,
				createdAt: account.createdAt,
				updatedAt: account.updatedAt
			}
		});
	} catch (cause) {
		console.error('Error fetching account:', summarizeError(cause));
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// PUT /api/accounts/[id] - Update an account
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const accountId = params.id;

	if (!accountId) {
		return json({ error: 'ID akun diperlukan' }, { status: 400 });
	}

	try {
		const body: unknown = await request.json().catch(() => null);
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return json({ error: 'Format permintaan tidak valid' }, { status: 400 });
		}
		const input = body as Record<string, unknown>;
		const db = getDb();

		// Check if account exists
		const existingAccount = await chartOfAccountQueries.findById(db, userId, accountId);

		if (!existingAccount) {
			return json({ error: 'Akun tidak ditemukan' }, { status: 404 });
		}

		// Validate name (if provided)
		const name = input.name === undefined ? undefined : parseAccountName(input.name);
		if (name && !name.ok) return json({ error: name.error }, { status: 400 });

		// Validate account type (if provided)
		if (
			input.type !== undefined &&
			(typeof input.type !== 'string' || !isValidAccountType(input.type))
		) {
			return json(
				{
					error: `Tipe akun tidak valid. Jenis yang diperbolehkan: ${VALID_ACCOUNT_TYPES.join(', ')}`
				},
				{ status: 400 }
			);
		}

		// Build update data
		const updateData: {
			name?: string;
			type?: string;
			subType?: string;
		} = {};

		if (name?.ok) {
			updateData.name = name.name;
		}

		if (typeof input.type === 'string' && isValidAccountType(input.type)) {
			const { type: schemaType, subType } = mapAccountType(input.type);
			updateData.type = schemaType;
			updateData.subType = subType;
		}

		if (Object.keys(updateData).length === 0) {
			return json({ error: 'Tidak ada perubahan untuk disimpan' }, { status: 400 });
		}

		// Update the account
		await chartOfAccountQueries.update(db, userId, accountId, updateData);

		const updatedAccount = await chartOfAccountQueries.findById(db, userId, accountId);
		if (!updatedAccount) {
			return json({ error: 'Akun gagal dimuat setelah diperbarui' }, { status: 500 });
		}

		return json({
			message: 'Akun berhasil diperbarui',
			account: {
				...updatedAccount,
				type: mapSchemaToApiType(updatedAccount.subType)
			}
		});
	} catch (cause) {
		console.error('Error updating account:', summarizeError(cause));
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// DELETE /api/accounts/[id] - Deactivate an account (soft delete) holding Rp0 with no transactions
export const DELETE: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const accountId = params.id;

	if (!accountId) {
		return json({ error: 'ID akun diperlukan' }, { status: 400 });
	}

	const db = getDb();

	try {
		const outcome = await deactivateAccount(db, userId, accountId);
		if (outcome !== 'deactivated') {
			const [error, status] = DEACTIVATION_ERRORS[outcome];
			return json({ error }, { status });
		}

		return json({
			message: 'Akun berhasil dinonaktifkan'
		});
	} catch (cause) {
		console.error('Error deleting account:', summarizeError(cause));
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
