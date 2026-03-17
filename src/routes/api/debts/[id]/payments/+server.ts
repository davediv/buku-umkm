import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { debtQueries, chartOfAccountQueries } from '$lib/server/db/queries';
import { transaction, chartOfAccount, debt, debtPayment } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { MAX_TRANSACTION_AMOUNT } from '$lib/constants';

interface CreatePaymentBody {
	amount: number;
	date: string;
	account_id: string;
	notes?: string;
}

// GET /api/debts/[id]/payments - Returns payment history for a debt
export const GET: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const debtId = params.id;

	if (!debtId) {
		return json({ error: 'ID hutang/piutang diperlukan' }, { status: 400 });
	}

	const db = getDb();

	try {
		const debt = await debtQueries.findById(db, userId, debtId);

		if (!debt) {
			return json({ error: 'Hutang/piutang tidak ditemukan' }, { status: 404 });
		}

		if (!debt.isActive) {
			return json({ error: 'Hutang/piutang sudah dihapus' }, { status: 400 });
		}

		// Map payments to API response format
		const payments = debt.payments.map((p) => ({
			id: p.id,
			amount: p.amount,
			date: p.date,
			accountId: p.accountId,
			transactionId: p.transactionId,
			notes: p.notes,
			createdAt: p.createdAt
		}));

		return json({
			debt: {
				id: debt.id,
				type: debt.type,
				contactName: debt.contactName,
				originalAmount: debt.originalAmount,
				paidAmount: debt.paidAmount,
				remainingAmount: debt.remainingAmount,
				status: debt.status
			},
			payments
		});
	} catch {
		console.error('Error fetching debt payments:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// POST /api/debts/[id]/payments - Creates a new payment for a debt
export const POST: RequestHandler = async ({ params, request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const debtId = params.id;

	if (!debtId) {
		return json({ error: 'ID hutang/piutang diperlukan' }, { status: 400 });
	}

	try {
		const body = (await request.json()) as CreatePaymentBody;

		// Validate required fields
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

		// Validate date format (YYYY-MM-DD)
		const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
		if (!dateRegex.test(body.date)) {
			return json({ error: 'Format tanggal harus YYYY-MM-DD' }, { status: 400 });
		}

		// Validate date - cannot be in the future
		const paymentDate = new Date(body.date);
		const today = new Date();
		today.setHours(23, 59, 59, 999);

		if (paymentDate > today) {
			return json({ error: 'Tanggal tidak boleh di masa depan' }, { status: 400 });
		}

		const db = getDb();

		// Get existing debt
		const existingDebt = await debtQueries.findById(db, userId, debtId);

		if (!existingDebt) {
			return json({ error: 'Hutang/piutang tidak ditemukan' }, { status: 404 });
		}

		if (!existingDebt.isActive) {
			return json({ error: 'Hutang/piutang sudah dihapus' }, { status: 400 });
		}

		// Check if debt is already fully paid
		if (existingDebt.status === 'paid') {
			return json({ error: 'Hutang/piutang sudah lunas' }, { status: 400 });
		}

		// Validate payment amount doesn't exceed remaining
		if (amount > existingDebt.remainingAmount) {
			return json(
				{
					error: `Jumlah pembayaran tidak boleh melebihi sisa tagihan (Rp${existingDebt.remainingAmount.toLocaleString('id-ID')})`
				},
				{ status: 400 }
			);
		}

		// Verify account belongs to user
		const account = await chartOfAccountQueries.findById(db, userId, body.account_id);
		if (!account) {
			return json({ error: 'Akun tidak ditemukan' }, { status: 400 });
		}

		// Determine transaction type:
		// - Piutang payment = income (receiving money from customer)
		// - Hutang payment = expense (paying money to supplier)
		const transactionType = existingDebt.type === 'piutang' ? 'income' : 'expense';

		// Create description for the transaction
		const transactionDescription =
			existingDebt.type === 'piutang'
				? `Pembayaran piutang dari ${existingDebt.contactName}`
				: `Pembayaran hutang ke ${existingDebt.contactName}`;

		// Determine balance change: income adds, expense subtracts
		const balanceChange = transactionType === 'income' ? amount : -amount;

		// Transaction ID for linking payment to transaction
		const transactionId = crypto.randomUUID();
		const paymentId = crypto.randomUUID();

		// Create transaction and update account balance in a database transaction
		await db.transaction(async (tx) => {
			// Create the transaction
			await tx.insert(transaction).values({
				id: transactionId,
				userId,
				date: body.date,
				type: transactionType,
				amount,
				description: transactionDescription,
				accountId: body.account_id,
				categoryId: null,
				toAccountId: null
			});

			// Update account balance
			await tx
				.update(chartOfAccount)
				.set({ balance: sql`${chartOfAccount.balance} + ${balanceChange}` })
				.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, body.account_id)));

			// Create payment record
			await tx.insert(debtPayment).values({
				id: paymentId,
				debtId,
				userId,
				amount,
				date: body.date,
				accountId: body.account_id,
				transactionId,
				notes: body.notes?.trim() ?? null
			});

			// Update debt remaining amount and status
			await tx
				.update(debt)
				.set({
					paidAmount: sql`${debt.paidAmount} + ${amount}`,
					remainingAmount: sql`${debt.remainingAmount} - ${amount}`,
					status: sql`CASE WHEN ${debt.remainingAmount} - ${amount} <= 0 THEN 'paid' ELSE ${debt.status} END`
				})
				.where(eq(debt.id, debtId));
		});

		// Calculate updated values in memory (no need for extra DB query)
		const newPaidAmount = existingDebt.paidAmount + amount;
		const newRemainingAmount = existingDebt.remainingAmount - amount;
		const newStatus = newRemainingAmount <= 0 ? 'paid' : existingDebt.status;

		return json(
			{
				message:
					newRemainingAmount <= 0
						? 'Pembayaran berhasil - hutang/piutang lunas'
						: 'Pembayaran berhasil dicatat',
				payment: {
					id: paymentId,
					amount,
					date: body.date,
					accountId: body.account_id,
					transactionId,
					notes: body.notes ?? null,
					createdAt: new Date().toISOString()
				},
				debt: {
					id: debtId,
					type: existingDebt.type,
					contactName: existingDebt.contactName,
					originalAmount: existingDebt.originalAmount,
					paidAmount: newPaidAmount,
					remainingAmount: newRemainingAmount,
					status: newStatus
				}
			},
			{ status: 201 }
		);
	} catch {
		console.error('Error creating debt payment:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
