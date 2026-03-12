import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { transaction, chartOfAccount } from '$lib/server/db/schema';
import { transactionQueries, chartOfAccountQueries, categoryQueries } from '$lib/server/db/queries';
import { eq, and, sql } from 'drizzle-orm';
import { MAX_TRANSACTION_AMOUNT } from '$lib/constants';

interface CreateTransactionBody {
	amount: number;
	type: 'income' | 'expense';
	category_id?: string;
	account_id: string;
	date: string;
	description?: string;
	to_account_id?: string;
}

// GET /api/transactions - Returns paginated transactions with filters
export const GET: RequestHandler = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Parse query params
		const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const accountId = url.searchParams.get('account_id') || undefined;
		const categoryId = url.searchParams.get('category_id') || undefined;
		const type = (url.searchParams.get('type') as 'income' | 'expense' | 'transfer') || undefined;
		const startDate = url.searchParams.get('start_date') || undefined;
		const endDate = url.searchParams.get('end_date') || undefined;

		const transactions = await transactionQueries.findAll(db, userId, {
			limit,
			offset,
			accountId,
			categoryId,
			type,
			startDate,
			endDate
		});

		// Map to API response format
		const mappedTransactions = transactions.map((t) => ({
			id: t.id,
			date: t.date,
			type: t.type,
			amount: t.amount,
			description: t.description,
			account: t.account
				? {
						id: t.account.id,
						name: t.account.name,
						code: t.account.code,
						type: t.account.subType
					}
				: null,
			category: t.category
				? {
						id: t.category.id,
						name: t.category.name,
						code: t.category.code,
						icon: t.category.icon,
						color: t.category.color
					}
				: null,
			toAccount: t.toAccount
				? {
						id: t.toAccount.id,
						name: t.toAccount.name,
						code: t.toAccount.code
					}
				: null,
			isTaxed: t.isTaxed,
			taxAmount: t.taxAmount,
			referenceNumber: t.referenceNumber,
			notes: t.notes,
			createdAt: t.createdAt,
			updatedAt: t.updatedAt
		}));

		return json({ transactions: mappedTransactions });
	} catch (error) {
		console.error('Error fetching transactions:', error);
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// POST /api/transactions - Creates a new transaction
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	try {
		const body = (await request.json()) as CreateTransactionBody;

		// Validate required fields
		if (!body.type || (body.type !== 'income' && body.type !== 'expense')) {
			return json({ error: 'Jenis transaksi wajib dipilih (income/expense)' }, { status: 400 });
		}

		if (!body.account_id) {
			return json({ error: 'Akun wajib dipilih' }, { status: 400 });
		}

		if (!body.date) {
			return json({ error: 'Tanggal wajib diisi' }, { status: 400 });
		}

		// Validate amount
		if (body.amount === undefined || body.amount === null) {
			return json({ error: 'Jumlah wajib diisi' }, { status: 400 });
		}

		const amount = Math.floor(Number(body.amount));

		if (amount <= 0) {
			return json({ error: 'Jumlah harus lebih dari 0' }, { status: 400 });
		}

		if (amount > MAX_TRANSACTION_AMOUNT) {
			return json(
				{ error: `Jumlah maksimal adalah Rp${MAX_TRANSACTION_AMOUNT.toLocaleString('id-ID')}` },
				{ status: 400 }
			);
		}

		// Validate date - cannot be in the future
		const transactionDate = new Date(body.date);
		const today = new Date();
		today.setHours(23, 59, 59, 999);

		if (transactionDate > today) {
			return json({ error: 'Tanggal tidak boleh di masa depan' }, { status: 400 });
		}

		const db = getDb();

		// Verify account belongs to user
		const account = await chartOfAccountQueries.findById(db, userId, body.account_id);
		if (!account) {
			return json({ error: 'Akun tidak ditemukan' }, { status: 400 });
		}

		// Verify category belongs to user (if provided)
		let category = null;
		if (body.category_id) {
			category = await categoryQueries.findById(db, userId, body.category_id);
			if (!category) {
				return json({ error: 'Kategori tidak ditemukan' }, { status: 400 });
			}
			// Verify category type matches transaction type
			if (category.type !== body.type) {
				return json(
					{
						error: `Kategori harus bertipe "${body.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}"`
					},
					{ status: 400 }
				);
			}
		}

		// Determine balance change: income adds, expense subtracts
		const balanceChange = body.type === 'income' ? amount : -amount;

		// Create transaction and update account balance in a transaction
		const transactionId = crypto.randomUUID();

		await db.transaction(async (tx) => {
			// Create the transaction
			await tx.insert(transaction).values({
				id: transactionId,
				userId,
				date: body.date,
				type: body.type,
				amount,
				description: body.description?.trim() ?? null,
				accountId: body.account_id,
				categoryId: body.category_id ?? null,
				toAccountId: body.to_account_id ?? null
			});

			// Update account balance
			await tx
				.update(chartOfAccount)
				.set({ balance: sql`${chartOfAccount.balance} + ${balanceChange}` })
				.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, body.account_id)));
		});

		const now = new Date().toISOString();
		return json(
			{
				message: 'Transaksi berhasil dibuat',
				transaction: {
					id: transactionId,
					date: body.date,
					type: body.type,
					amount,
					description: body.description?.trim() ?? null,
					account_id: body.account_id,
					category_id: body.category_id ?? null,
					createdAt: now,
					updatedAt: now
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error creating transaction:', error);
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
