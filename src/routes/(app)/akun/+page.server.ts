import type { PageServerLoad, Actions } from './$types';
import { getDb } from '$lib/server/db';
import { chartOfAccountQueries } from '$lib/server/db/queries';
import { error as httpError, redirect, fail } from '@sveltejs/kit';
import { chartOfAccount } from '$lib/server/db/schema';
import {
	ACCOUNT_TYPE_MAP,
	mapSchemaToApiType,
	isValidAccountType,
	parseAccountName
} from '$lib/shared/account-types';
import { reactivateAccount } from '$lib/server/finance/accounts';
import { isIsoCalendarDate, todayInJakarta } from '$lib/shared/dates';
import { MAX_TRANSACTION_AMOUNT } from '$lib/constants';
import { summarizeError } from '$lib/server/error-summary';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		const accounts = await chartOfAccountQueries.findAll(db, userId);

		// Asset accounts (cash, bank, ewallet), mapped to the API response format.
		// Inactive ones are listed separately: they take no new entries, but their
		// balance still counts on the dashboard and the balance sheet.
		const mappedAccounts = accounts
			.filter((account) => account.type === 'asset' && account.subType)
			.map((account) => ({
				id: account.id,
				name: account.name,
				type: mapSchemaToApiType(account.subType),
				balance: account.balance,
				code: account.code,
				isActive: account.isActive,
				createdAt: account.createdAt,
				updatedAt: account.updatedAt
			}));

		return {
			accounts: mappedAccounts.filter((account) => account.isActive),
			inactiveAccounts: mappedAccounts.filter((account) => !account.isActive)
		};
	} catch (cause) {
		console.error('Error fetching accounts:', summarizeError(cause));
		throw httpError(500, 'Kas dan rekening tidak dapat dimuat. Data Anda tidak diubah.');
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user || !locals.session) {
			return fail(401, { error: 'Unauthorized' });
		}

		const userId = locals.user.id;
		const db = getDb();

		try {
			const formData = await request.formData();
			const name = parseAccountName(formData.get('name'));
			const type = formData.get('type') as 'cash' | 'bank' | 'ewallet';
			const openingBalance = Number(formData.get('opening_balance')?.toString() || 0);
			const openingDate = formData.get('opening_date')?.toString() || todayInJakarta();

			if (!name.ok) return fail(400, { error: name.error, success: false });

			// Validate type
			if (!type || !isValidAccountType(type)) {
				return fail(400, { error: 'Jenis akun tidak valid', success: false });
			}

			// Validate opening balance
			if (
				!Number.isSafeInteger(openingBalance) ||
				openingBalance < 0 ||
				openingBalance > MAX_TRANSACTION_AMOUNT
			) {
				return fail(400, { error: 'Saldo awal tidak valid', success: false });
			}
			if (!isIsoCalendarDate(openingDate) || openingDate > todayInJakarta()) {
				return fail(400, { error: 'Tanggal saldo awal tidak valid', success: false });
			}

			// Map account type to schema values
			const { type: schemaType, subType } = ACCOUNT_TYPE_MAP[type];

			// Generate a unique code for the account
			const existingAccounts = await chartOfAccountQueries.findByType(db, userId, 'asset');
			const maxCode = existingAccounts.reduce((max, acc) => {
				const codeNum = parseInt(acc.code, 10);
				return codeNum > max ? codeNum : max;
			}, 1000);
			const newCode = String(maxCode + 1);

			// Generate ID and create account
			const accountId = crypto.randomUUID();

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
			return {
				success: true,
				message: 'Akun berhasil dibuat',
				account: {
					...createdAccount,
					type: mapSchemaToApiType(createdAccount.subType)
				}
			};
		} catch (cause) {
			console.error('Error creating account:', summarizeError(cause));
			return fail(500, { error: 'Terjadi kesalahan server', success: false });
		}
	},

	update: async ({ request, locals }) => {
		if (!locals.user || !locals.session) {
			return fail(401, { error: 'Unauthorized', success: false });
		}

		const userId = locals.user.id;
		const db = getDb();

		try {
			const formData = await request.formData();
			const id = formData.get('id') as string;
			const name = parseAccountName(formData.get('name'));
			const type = formData.get('type') as string;

			// Validate required fields
			if (!id) {
				return fail(400, { error: 'ID akun diperlukan', success: false });
			}

			if (!name.ok) return fail(400, { error: name.error, success: false });

			// Validate type
			if (!type || !isValidAccountType(type)) {
				return fail(400, { error: 'Jenis akun tidak valid', success: false });
			}

			// Check if account exists
			const existingAccount = await chartOfAccountQueries.findById(db, userId, id);
			if (!existingAccount) {
				return fail(404, { error: 'Akun tidak ditemukan', success: false });
			}

			// Map account type to schema values
			const { type: schemaType, subType } = ACCOUNT_TYPE_MAP[type];

			// Update the account
			await chartOfAccountQueries.update(db, userId, id, {
				name: name.name,
				type: schemaType,
				subType
			});
			const updatedAccount = await chartOfAccountQueries.findById(db, userId, id);

			return {
				success: true,
				message: 'Akun berhasil diperbarui',
				account: updatedAccount
					? { ...updatedAccount, type: mapSchemaToApiType(updatedAccount.subType) }
					: null
			};
		} catch (cause) {
			console.error('Error updating account:', summarizeError(cause));
			return fail(500, { error: 'Terjadi kesalahan server', success: false });
		}
	},

	reactivate: async ({ request, locals }) => {
		if (!locals.user || !locals.session) {
			return fail(401, { error: 'Unauthorized', success: false });
		}

		try {
			const id = (await request.formData()).get('id');
			if (typeof id !== 'string' || !id) {
				return fail(400, { error: 'ID akun diperlukan', success: false });
			}

			const outcome = await reactivateAccount(getDb(), locals.user.id, id);
			if (outcome === 'not_found') {
				return fail(404, { error: 'Akun tidak ditemukan', success: false });
			}
			if (outcome === 'already_active') {
				return fail(400, { error: 'Akun sudah aktif', success: false });
			}
			return {
				success: true,
				message: 'Akun aktif kembali dan dapat dipakai untuk transaksi baru.'
			};
		} catch (cause) {
			console.error('Error reactivating account:', summarizeError(cause));
			return fail(500, { error: 'Terjadi kesalahan server', success: false });
		}
	}
};
