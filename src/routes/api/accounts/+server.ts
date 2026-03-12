import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { chartOfAccount } from '$lib/server/db/schema';
import { chartOfAccountQueries } from '$lib/server/db/queries';
import {
	VALID_ACCOUNT_TYPES,
	type AccountType,
	isValidAccountType,
	mapAccountType,
	mapSchemaToApiType,
	filterActiveAccounts
} from '$lib/shared/account-types';

interface CreateAccountBody {
	name: string;
	type: AccountType;
	opening_balance?: number;
}

// GET /api/accounts - Returns all accounts for authenticated user
export const GET: RequestHandler = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		const accounts = await chartOfAccountQueries.findAll(db, userId);

		// Filter only active asset accounts (cash, bank, ewallet)
		const filteredAccounts = filterActiveAccounts(accounts);

		// Map to API response format
		const mappedAccounts = filteredAccounts.map((account) => ({
			id: account.id,
			name: account.name,
			type: mapSchemaToApiType(account.subType),
			balance: account.balance,
			code: account.code,
			createdAt: account.createdAt,
			updatedAt: account.updatedAt
		}));

		return json({ accounts: mappedAccounts });
	} catch (error) {
		console.error('Error fetching accounts:', error);
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// POST /api/accounts - Creates a new account
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	try {
		const body = (await request.json()) as CreateAccountBody;

		// Validate required fields
		if (!body.name || body.name.trim() === '') {
			return json({ error: 'Nama akun wajib diisi' }, { status: 400 });
		}

		// Validate account type
		if (!body.type || !isValidAccountType(body.type)) {
			return json(
				{
					error: `Tipe akun tidak valid. Jenis yang diperbolehkan: ${VALID_ACCOUNT_TYPES.join(', ')}`
				},
				{ status: 400 }
			);
		}

		// Validate opening balance (if provided)
		const openingBalance = body.opening_balance ?? 0;
		if (openingBalance < 0) {
			return json({ error: 'Saldo awal tidak boleh negatif' }, { status: 400 });
		}

		const db = getDb();

		// Generate a unique code for the account (1xxx for assets)
		const existingAccounts = await chartOfAccountQueries.findByType(db, userId, 'asset');
		const maxCode = existingAccounts.reduce((max, acc) => {
			const codeNum = parseInt(acc.code, 10);
			return codeNum > max ? codeNum : max;
		}, 1000);
		const newCode = String(maxCode + 1);

		// Map account type to schema values
		const { type: schemaType, subType } = mapAccountType(body.type);

		// Generate ID first
		const accountId = crypto.randomUUID();

		// Create the account
		await db.insert(chartOfAccount).values({
			id: accountId,
			userId,
			code: newCode,
			name: body.name.trim(),
			type: schemaType,
			subType,
			isSystem: false,
			isActive: true,
			balance: openingBalance
		});

		// Return response using the data we already have
		const now = new Date().toISOString();
		return json(
			{
				message: 'Akun berhasil dibuat',
				account: {
					id: accountId,
					name: body.name.trim(),
					type: body.type,
					balance: openingBalance,
					code: newCode,
					createdAt: now,
					updatedAt: now
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error creating account:', error);
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
