import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { chartOfAccountQueries } from '$lib/server/db/queries';
import { eq, or, and } from 'drizzle-orm';
import { transaction } from '$lib/server/db/schema';
import {
	VALID_ACCOUNT_TYPES,
	type AccountType,
	isValidAccountType,
	mapAccountType,
	mapSchemaToApiType
} from '$lib/shared/account-types';

interface UpdateAccountBody {
	name?: string;
	type?: AccountType;
}

// Helper to check if account has transactions (scoped to user)
async function hasTransactions(
	db: ReturnType<typeof getDb>,
	userId: string,
	accountId: string
): Promise<boolean> {
	const transactions = await db.query.transaction.findFirst({
		where: and(
			eq(transaction.userId, userId),
			or(eq(transaction.accountId, accountId), eq(transaction.toAccountId, accountId))
		)
	});
	return !!transactions;
}

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
	} catch {
		console.error('Error fetching account:');
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
		const body = (await request.json()) as UpdateAccountBody;
		const db = getDb();

		// Check if account exists
		const existingAccount = await chartOfAccountQueries.findById(db, userId, accountId);

		if (!existingAccount) {
			return json({ error: 'Akun tidak ditemukan' }, { status: 404 });
		}

		// Validate name (if provided)
		if (body.name !== undefined && body.name.trim() === '') {
			return json({ error: 'Nama akun tidak boleh kosong' }, { status: 400 });
		}

		if (body.name !== undefined && body.name.length > 200) {
			return json({ error: 'Nama akun maksimal 200 karakter' }, { status: 400 });
		}

		// Validate account type (if provided)
		if (body.type !== undefined && !isValidAccountType(body.type)) {
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

		if (body.name !== undefined) {
			updateData.name = body.name.trim();
		}

		if (body.type !== undefined) {
			const { type: schemaType, subType } = mapAccountType(body.type);
			updateData.type = schemaType;
			updateData.subType = subType;
		}

		// Update the account
		await chartOfAccountQueries.update(db, userId, accountId, updateData);

		// Construct response from existing account and update data
		const updatedName = updateData.name ?? existingAccount.name;
		const updatedSubType = updateData.subType ?? existingAccount.subType;

		return json({
			message: 'Akun berhasil diperbarui',
			account: {
				id: existingAccount.id,
				name: updatedName,
				type: mapSchemaToApiType(updatedSubType),
				balance: existingAccount.balance,
				code: existingAccount.code,
				isActive: existingAccount.isActive,
				createdAt: existingAccount.createdAt,
				updatedAt: new Date().toISOString()
			}
		});
	} catch {
		console.error('Error updating account:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// DELETE /api/accounts/[id] - Deactivate an account (soft delete) if no transactions exist
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
		// Check if account exists
		const existingAccount = await chartOfAccountQueries.findById(db, userId, accountId);

		if (!existingAccount) {
			return json({ error: 'Akun tidak ditemukan' }, { status: 404 });
		}

		// Check if account already inactive
		if (!existingAccount.isActive) {
			return json({ error: 'Akun sudah dinonaktifkan' }, { status: 400 });
		}

		// Check if account has transactions
		const hasTxns = await hasTransactions(db, userId, accountId);

		if (hasTxns) {
			return json(
				{
					error: 'Tidak dapat menghapus akun yang memiliki transaksi. Nonaktifkan akun instead.'
				},
				{ status: 400 }
			);
		}

		// Deactivate (soft delete) the account
		await chartOfAccountQueries.update(db, userId, accountId, { isActive: false });

		return json({
			message: 'Akun berhasil dinonaktifkan'
		});
	} catch {
		console.error('Error deleting account:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
