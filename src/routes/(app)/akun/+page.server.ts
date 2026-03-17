import type { PageServerLoad, Actions } from './$types';
import { getDb } from '$lib/server/db';
import { chartOfAccountQueries } from '$lib/server/db/queries';
import { redirect, fail } from '@sveltejs/kit';
import { chartOfAccount } from '$lib/server/db/schema';
import {
	ACCOUNT_TYPE_MAP,
	filterActiveAccounts,
	mapSchemaToApiType,
	isValidAccountType
} from '$lib/shared/account-types';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
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

		return {
			accounts: mappedAccounts
		};
	} catch {
		console.error('Error fetching accounts:');
		return {
			accounts: [],
			error: 'Gagal memuat data akun'
		};
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
			const name = formData.get('name') as string;
			const type = formData.get('type') as 'cash' | 'bank' | 'ewallet';
			const openingBalance = parseInt(formData.get('opening_balance') as string, 10) || 0;

			// Validate required fields
			if (!name || name.trim() === '') {
				return fail(400, { error: 'Nama akun wajib diisi', success: false });
			}

			// Validate type
			if (!type || !isValidAccountType(type)) {
				return fail(400, { error: 'Jenis akun tidak valid', success: false });
			}

			// Validate opening balance
			if (openingBalance < 0) {
				return fail(400, { error: 'Saldo awal tidak boleh negatif', success: false });
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

			await db.insert(chartOfAccount).values({
				id: accountId,
				userId,
				code: newCode,
				name: name.trim(),
				type: schemaType,
				subType,
				isSystem: false,
				isActive: true,
				balance: openingBalance
			});

			const now = new Date().toISOString();
			return {
				success: true,
				message: 'Akun berhasil dibuat',
				account: {
					id: accountId,
					name: name.trim(),
					type: mapSchemaToApiType(subType),
					balance: openingBalance,
					code: newCode,
					createdAt: now,
					updatedAt: now
				}
			};
		} catch {
			console.error('Error creating account:');
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
			const name = formData.get('name') as string;
			const type = formData.get('type') as string;

			// Validate required fields
			if (!id) {
				return fail(400, { error: 'ID akun diperlukan', success: false });
			}

			if (!name || name.trim() === '') {
				return fail(400, { error: 'Nama akun wajib diisi', success: false });
			}

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
				name: name.trim(),
				type: schemaType,
				subType
			});

			return {
				success: true,
				message: 'Akun berhasil diperbarui'
			};
		} catch {
			console.error('Error updating account:');
			return fail(500, { error: 'Terjadi kesalahan server', success: false });
		}
	}
};
