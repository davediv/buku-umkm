import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { chartOfAccount } from '#lib/server/db/schema.ts';
import { chartOfAccountQueries } from '#lib/server/db/queries/index.ts';
import {
	VALID_ACCOUNT_TYPES,
	isValidAccountType,
	mapAccountType,
	mapSchemaToApiType,
	filterActiveAccounts,
	parseAccountName
} from '#lib/shared/account-types.ts';
import { isIsoCalendarDate, todayInJakarta } from '#lib/shared/dates.ts';
import { MAX_TRANSACTION_AMOUNT } from '#lib/constants.ts';
import { summarizeError } from '#lib/server/error-summary.ts';

// GET /api/accounts - Returns all accounts for authenticated user
export const GET: RequestHandler = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

		return Response.json({ accounts: mappedAccounts });
	} catch (cause) {
		console.error('Error fetching accounts:', summarizeError(cause));
		return Response.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// POST /api/accounts - Creates a new account
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	try {
		const body: unknown = await request.json().catch(() => null);
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return Response.json({ error: 'Format permintaan tidak valid' }, { status: 400 });
		}
		const input = body as Record<string, unknown>;

		const name = parseAccountName(input.name);
		if (!name.ok) return Response.json({ error: name.error }, { status: 400 });

		// Validate account type
		if (typeof input.type !== 'string' || !isValidAccountType(input.type)) {
			return Response.json(
				{
					error: `Tipe akun tidak valid. Jenis yang diperbolehkan: ${VALID_ACCOUNT_TYPES.join(', ')}`
				},
				{ status: 400 }
			);
		}

		// Validate opening balance (if provided)
		const openingBalance = input.opening_balance ?? 0;
		if (
			typeof openingBalance !== 'number' ||
			!Number.isSafeInteger(openingBalance) ||
			openingBalance < 0 ||
			openingBalance > MAX_TRANSACTION_AMOUNT
		) {
			return Response.json({ error: 'Saldo awal tidak valid' }, { status: 400 });
		}
		const openingDate = input.opening_date ?? todayInJakarta();
		if (
			typeof openingDate !== 'string' ||
			!isIsoCalendarDate(openingDate) ||
			openingDate > todayInJakarta()
		) {
			return Response.json({ error: 'Tanggal saldo awal tidak valid' }, { status: 400 });
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
		const { type: schemaType, subType } = mapAccountType(input.type);

		// Generate ID first
		const accountId = crypto.randomUUID();

		// Create the account
		const [createdAccount] = await db
			.insert(chartOfAccount)
			.values({
				id: accountId,
				userId,
				code: newCode,
				name: name.name,
				type: schemaType,
				subType,
				isSystem: false,
				isActive: true,
				balance: openingBalance,
				openingBalance,
				openingDate
			})
			.returning();

		return Response.json(
			{
				message: 'Akun berhasil dibuat',
				account: {
					...createdAccount,
					type: mapSchemaToApiType(createdAccount.subType)
				}
			},
			{ status: 201 }
		);
	} catch (cause) {
		console.error('Error creating account:', summarizeError(cause));
		return Response.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
