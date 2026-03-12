import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { transaction, chartOfAccount } from '$lib/server/db/schema';
import { transactionQueries, categoryQueries } from '$lib/server/db/queries';
import { eq, and, sql } from 'drizzle-orm';
import { MAX_TRANSACTION_AMOUNT } from '$lib/constants';

interface UpdateTransactionBody {
	amount?: number;
	category_id?: string;
	date?: string;
	description?: string;
	reference_number?: string;
	notes?: string;
}

// GET /api/transactions/[id] - Get a single transaction
export const GET: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const transactionId = params.id;

	if (!transactionId) {
		return json({ error: 'ID transaksi diperlukan' }, { status: 400 });
	}

	const db = getDb();

	try {
		const txn = await transactionQueries.findById(db, userId, transactionId);

		if (!txn) {
			return json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
		}

		return json({
			transaction: {
				id: txn.id,
				date: txn.date,
				type: txn.type,
				amount: txn.amount,
				description: txn.description,
				account: txn.account
					? {
							id: txn.account.id,
							name: txn.account.name,
							code: txn.account.code,
							type: txn.account.subType
						}
					: null,
				category: txn.category
					? {
							id: txn.category.id,
							name: txn.category.name,
							code: txn.category.code,
							icon: txn.category.icon,
							color: txn.category.color
						}
					: null,
				toAccount: txn.toAccount
					? {
							id: txn.toAccount.id,
							name: txn.toAccount.name,
							code: txn.toAccount.code
						}
					: null,
				isTaxed: txn.isTaxed,
				taxAmount: txn.taxAmount,
				referenceNumber: txn.referenceNumber,
				notes: txn.notes,
				createdAt: txn.createdAt,
				updatedAt: txn.updatedAt
			}
		});
	} catch (error) {
		console.error('Error fetching transaction:', error);
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// PUT /api/transactions/[id] - Update a transaction
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const transactionId = params.id;

	if (!transactionId) {
		return json({ error: 'ID transaksi diperlukan' }, { status: 400 });
	}

	try {
		const body = (await request.json()) as UpdateTransactionBody;
		const db = getDb();

		// Get existing transaction
		const existingTxn = await transactionQueries.findById(db, userId, transactionId);

		if (!existingTxn) {
			return json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
		}

		// Validate amount (if provided)
		if (body.amount !== undefined) {
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
		}

		// Validate date (if provided) - cannot be in the future
		if (body.date) {
			const transactionDate = new Date(body.date);
			const today = new Date();
			today.setHours(23, 59, 59, 999);

			if (transactionDate > today) {
				return json({ error: 'Tanggal tidak boleh di masa depan' }, { status: 400 });
			}
		}

		// Validate category (if provided)
		if (body.category_id) {
			const category = await categoryQueries.findById(db, userId, body.category_id);
			if (!category) {
				return json({ error: 'Kategori tidak ditemukan' }, { status: 400 });
			}
			// Verify category type matches transaction type
			if (category.type !== existingTxn.type) {
				return json(
					{
						error: `Kategori harus bertipe "${
							existingTxn.type === 'income' ? 'Pemasukan' : 'Pengeluaran'
						}"`
					},
					{ status: 400 }
				);
			}
		}

		// Build update data
		const updateData: {
			date?: string;
			amount?: number;
			description?: string | null;
			categoryId?: string | null;
			referenceNumber?: string | null;
			notes?: string | null;
		} = {};

		if (body.date !== undefined) {
			updateData.date = body.date;
		}

		if (body.amount !== undefined) {
			updateData.amount = Math.floor(Number(body.amount));
		}

		if (body.description !== undefined) {
			updateData.description = body.description?.trim() ?? null;
		}

		if (body.category_id !== undefined) {
			updateData.categoryId = body.category_id || null;
		}

		if (body.reference_number !== undefined) {
			updateData.referenceNumber = body.reference_number?.trim() ?? null;
		}

		if (body.notes !== undefined) {
			updateData.notes = body.notes?.trim() ?? null;
		}

		// If amount changed, we need to update the account balance
		const oldAmount = existingTxn.amount;
		const newAmount = updateData.amount ?? oldAmount;
		const accountId = existingTxn.accountId;

		await db.transaction(async (tx) => {
			// Update the transaction
			await tx
				.update(transaction)
				.set(updateData)
				.where(and(eq(transaction.userId, userId), eq(transaction.id, transactionId)));

			// If amount changed, adjust account balance
			if (newAmount !== oldAmount) {
				const oldBalanceChange = existingTxn.type === 'income' ? oldAmount : -oldAmount;
				const newBalanceChange = existingTxn.type === 'income' ? newAmount : -newAmount;
				const balanceDiff = newBalanceChange - oldBalanceChange;

				await tx
					.update(chartOfAccount)
					.set({ balance: sql`${chartOfAccount.balance} + ${balanceDiff}` })
					.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, accountId)));
			}
		});

		// Fetch updated transaction
		const updatedTxn = await transactionQueries.findById(db, userId, transactionId);

		return json({
			message: 'Transaksi berhasil diperbarui',
			transaction: {
				id: updatedTxn!.id,
				date: updatedTxn!.date,
				type: updatedTxn!.type,
				amount: updatedTxn!.amount,
				description: updatedTxn!.description,
				account_id: updatedTxn!.accountId,
				category_id: updatedTxn!.categoryId,
				referenceNumber: updatedTxn!.referenceNumber,
				notes: updatedTxn!.notes,
				createdAt: updatedTxn!.createdAt,
				updatedAt: updatedTxn!.updatedAt
			}
		});
	} catch (error) {
		console.error('Error updating transaction:', error);
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// DELETE /api/transactions/[id] - Soft delete a transaction
export const DELETE: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const transactionId = params.id;

	if (!transactionId) {
		return json({ error: 'ID transaksi diperlukan' }, { status: 400 });
	}

	const db = getDb();

	try {
		// Get existing transaction
		const existingTxn = await transactionQueries.findById(db, userId, transactionId);

		if (!existingTxn) {
			return json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
		}

		// Check if already deleted
		if (!existingTxn.isActive) {
			return json({ error: 'Transaksi sudah dihapus' }, { status: 400 });
		}

		// Reverse the account balance change
		const balanceChange = existingTxn.type === 'income' ? existingTxn.amount : -existingTxn.amount;

		await db.transaction(async (tx) => {
			// Soft delete: set isActive to false
			await tx
				.update(transaction)
				.set({ isActive: false })
				.where(and(eq(transaction.userId, userId), eq(transaction.id, transactionId)));

			// Reverse account balance
			await tx
				.update(chartOfAccount)
				.set({ balance: sql`${chartOfAccount.balance} - ${balanceChange}` })
				.where(
					and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, existingTxn.accountId))
				);
		});

		return json({
			message: 'Transaksi berhasil dihapus'
		});
	} catch (error) {
		console.error('Error deleting transaction:', error);
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
