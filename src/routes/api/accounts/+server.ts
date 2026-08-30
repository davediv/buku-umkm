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
import { isIsoCalendarDate, todayInJakarta } from '$lib/shared/dates';
import { MAX_TRANSACTION_AMOUNT } from '$lib/constants';

interface CreateAccountBody {
	name: string;
	type: AccountType;
	opening_balance?: number;
	opening_date?: string;
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
	} catch {
		console.error('Error fetching accounts:');
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
		if (
			!Number.isSafeInteger(openingBalance) ||
			openingBalance < 0 ||
			openingBalance > MAX_TRANSACTION_AMOUNT
		) {
			return json({ error: 'Saldo awal tidak valid' }, { status: 400 });
		}
		const openingDate = body.opening_date ?? todayInJakarta();
		if (!isIsoCalendarDate(openingDate) || openingDate > todayInJakarta()) {
			return json({ error: 'Tanggal saldo awal tidak valid' }, { status: 400 });
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
		const [createdAccount] = await db
			.insert(chartOfAccount)
			.values({
				id: accountId,
				userId,
				code: newCode,
				name: body.name.trim(),
				type: schemaType,
				subType,
				isSystem: false,
				isActive: true,
				balance: openingBalance,
				openingBalance,
				openingDate
			})
			.returning();

		return json(
			{
				message: 'Akun berhasil dibuat',
				account: {
					...createdAccount,
					type: mapSchemaToApiType(createdAccount.subType)
				}
			},
			{ status: 201 }
		);
	} catch {
		console.error('Error creating account:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
