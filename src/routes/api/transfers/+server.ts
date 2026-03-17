import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { transaction, chartOfAccount } from '$lib/server/db/schema';
import { chartOfAccountQueries } from '$lib/server/db/queries';
import { eq, and, sql } from 'drizzle-orm';
import { MAX_TRANSACTION_AMOUNT } from '$lib/constants';

interface CreateTransferBody {
	amount: number;
	source_account_id: string;
	destination_account_id: string;
	date: string;
	description?: string;
}

// POST /api/transfers - Creates a transfer between two accounts
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	try {
		const body = (await request.json()) as CreateTransferBody;

		// Validate required fields
		if (!body.source_account_id) {
			return json({ error: 'Akun sumber wajib dipilih' }, { status: 400 });
		}

		if (!body.destination_account_id) {
			return json({ error: 'Akun tujuan wajib dipilih' }, { status: 400 });
		}

		if (!body.date) {
			return json({ error: 'Tanggal wajib diisi' }, { status: 400 });
		}

		// Validate source and destination are different
		if (body.source_account_id === body.destination_account_id) {
			return json({ error: 'Akun sumber dan tujuan tidak boleh sama' }, { status: 400 });
		}

		// Validate amount
		if (body.amount === undefined || body.amount === null) {
			return json({ error: 'Jumlah wajib diisi' }, { status: 400 });
		}

		const amount = Math.floor(Number(body.amount));

		if (Number.isNaN(amount)) {
			return json({ error: 'Jumlah tidak valid' }, { status: 400 });
		}

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
		const transferDate = new Date(body.date);
		const today = new Date();
		today.setHours(23, 59, 59, 999);

		if (transferDate > today) {
			return json({ error: 'Tanggal tidak boleh di masa depan' }, { status: 400 });
		}

		const db = getDb();

		// Verify source account belongs to user
		const sourceAccount = await chartOfAccountQueries.findById(db, userId, body.source_account_id);
		if (!sourceAccount) {
			return json({ error: 'Akun sumber tidak ditemukan' }, { status: 400 });
		}

		// Verify destination account belongs to user
		const destinationAccount = await chartOfAccountQueries.findById(
			db,
			userId,
			body.destination_account_id
		);
		if (!destinationAccount) {
			return json({ error: 'Akun tujuan tidak ditemukan' }, { status: 400 });
		}

		// Generate transfer ID to link both transactions
		const transferId = crypto.randomUUID();
		const now = new Date().toISOString();

		// Create transfer and update both account balances in a transaction
		// Balance check is inside the transaction to prevent TOCTOU race conditions
		await db.transaction(async (tx) => {
			// Re-read balance inside transaction to prevent race condition
			const [currentSource] = await tx
				.select({ balance: chartOfAccount.balance })
				.from(chartOfAccount)
				.where(
					and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, body.source_account_id))
				);

			if (!currentSource || currentSource.balance < amount) {
				throw new Error('Saldo tidak mencukupi');
			}
			// Create expense transaction (money out from source)
			const expenseId = crypto.randomUUID();
			await tx.insert(transaction).values({
				id: expenseId,
				userId,
				date: body.date,
				type: 'expense',
				amount,
				description: body.description?.trim() ?? `Transfer ke ${destinationAccount.name}`,
				accountId: body.source_account_id,
				toAccountId: body.destination_account_id,
				categoryId: null,
				referenceNumber: transferId // Link to transfer
			});

			// Create income transaction (money in to destination)
			const incomeId = crypto.randomUUID();
			await tx.insert(transaction).values({
				id: incomeId,
				userId,
				date: body.date,
				type: 'income',
				amount,
				description: body.description?.trim() ?? `Transfer dari ${sourceAccount.name}`,
				accountId: body.destination_account_id,
				toAccountId: body.source_account_id,
				categoryId: null,
				referenceNumber: transferId // Link to transfer
			});

			// Update source account balance (decrement)
			await tx
				.update(chartOfAccount)
				.set({ balance: sql`${chartOfAccount.balance} - ${amount}` })
				.where(
					and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, body.source_account_id))
				);

			// Update destination account balance (increment)
			await tx
				.update(chartOfAccount)
				.set({ balance: sql`${chartOfAccount.balance} + ${amount}` })
				.where(
					and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, body.destination_account_id))
				);
		});

		return json(
			{
				message: 'Transfer berhasil dibuat',
				transfer: {
					id: transferId,
					date: body.date,
					amount,
					description: body.description?.trim() ?? null,
					sourceAccount: {
						id: sourceAccount.id,
						name: sourceAccount.name,
						code: sourceAccount.code
					},
					destinationAccount: {
						id: destinationAccount.id,
						name: destinationAccount.name,
						code: destinationAccount.code
					},
					createdAt: now,
					updatedAt: now
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		// Handle balance insufficient error from transaction
		if (error instanceof Error && error.message === 'Saldo tidak mencukupi') {
			return json({ error: 'Saldo tidak mencukupi' }, { status: 400 });
		}
		console.error('Error creating transfer');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
