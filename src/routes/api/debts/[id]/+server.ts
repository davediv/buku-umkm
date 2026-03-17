import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { debtQueries } from '$lib/server/db/queries';

interface UpdateDebtBody {
	contact_name?: string;
	contact_phone?: string;
	contact_address?: string;
	due_date?: string;
	description?: string;
}

// GET /api/debts/[id] - Get a single debt
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

		// Check if debt is active
		if (!debt.isActive) {
			return json({ error: 'Hutang/piutang sudah dihapus' }, { status: 400 });
		}

		return json({
			debt: {
				id: debt.id,
				type: debt.type,
				contactName: debt.contactName,
				contactPhone: debt.contactPhone,
				contactAddress: debt.contactAddress,
				originalAmount: debt.originalAmount,
				paidAmount: debt.paidAmount,
				remainingAmount: debt.remainingAmount,
				date: debt.date,
				dueDate: debt.dueDate,
				description: debt.description,
				status: debt.status,
				createdAt: debt.createdAt,
				updatedAt: debt.updatedAt,
				payments: debt.payments.map((p) => ({
					id: p.id,
					amount: p.amount,
					date: p.date,
					accountId: p.accountId,
					transactionId: p.transactionId,
					notes: p.notes,
					createdAt: p.createdAt
				}))
			}
		});
	} catch {
		console.error('Error fetching debt:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// PUT /api/debts/[id] - Update a debt
export const PUT: RequestHandler = async ({ params, request, locals }) => {
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
		const body = (await request.json()) as UpdateDebtBody;
		const db = getDb();

		// Get existing debt
		const existingDebt = await debtQueries.findById(db, userId, debtId);

		if (!existingDebt) {
			return json({ error: 'Hutang/piutang tidak ditemukan' }, { status: 404 });
		}

		if (!existingDebt.isActive) {
			return json({ error: 'Hutang/piutang sudah dihapus' }, { status: 400 });
		}

		// Validate contact_name if provided
		if (body.contact_name !== undefined && body.contact_name.trim() === '') {
			return json({ error: 'Nama kontak tidak boleh kosong' }, { status: 400 });
		}

		// Validate due date format if provided
		if (body.due_date !== undefined) {
			if (body.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date)) {
				return json({ error: 'Format tanggal jatuh tempo harus YYYY-MM-DD' }, { status: 400 });
			}
		}

		// Build update data
		const updateData: {
			contactName?: string;
			contactPhone?: string | null;
			contactAddress?: string | null;
			dueDate?: string | null;
			description?: string | null;
		} = {};

		if (body.contact_name !== undefined) {
			updateData.contactName = body.contact_name.trim();
		}

		if (body.contact_phone !== undefined) {
			updateData.contactPhone = body.contact_phone?.trim() ?? null;
		}

		if (body.contact_address !== undefined) {
			updateData.contactAddress = body.contact_address?.trim() ?? null;
		}

		if (body.due_date !== undefined) {
			updateData.dueDate = body.due_date ?? null;
		}

		if (body.description !== undefined) {
			updateData.description = body.description?.trim() ?? null;
		}

		// Update the debt
		await debtQueries.update(db, userId, debtId, updateData);

		// Fetch updated debt
		const updatedDebt = await debtQueries.findById(db, userId, debtId);

		if (!updatedDebt) {
			return json({ error: 'Terjadi kesalahan saat mengambil data' }, { status: 500 });
		}

		return json({
			message: 'Hutang/piutang berhasil diperbarui',
			debt: {
				id: updatedDebt.id,
				type: updatedDebt.type,
				contactName: updatedDebt.contactName,
				contactPhone: updatedDebt.contactPhone,
				contactAddress: updatedDebt.contactAddress,
				originalAmount: updatedDebt.originalAmount,
				paidAmount: updatedDebt.paidAmount,
				remainingAmount: updatedDebt.remainingAmount,
				date: updatedDebt.date,
				dueDate: updatedDebt.dueDate,
				description: updatedDebt.description,
				status: updatedDebt.status,
				createdAt: updatedDebt.createdAt,
				updatedAt: updatedDebt.updatedAt
			}
		});
	} catch {
		console.error('Error updating debt:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// DELETE /api/debts/[id] - Soft delete a debt
export const DELETE: RequestHandler = async ({ params, locals }) => {
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
		// Get existing debt
		const existingDebt = await debtQueries.findById(db, userId, debtId);

		if (!existingDebt) {
			return json({ error: 'Hutang/piutang tidak ditemukan' }, { status: 404 });
		}

		if (!existingDebt.isActive) {
			return json({ error: 'Hutang/piutang sudah dihapus' }, { status: 400 });
		}

		// Soft delete: set isActive to false
		await debtQueries.delete(db, userId, debtId);

		return json({
			message: 'Hutang/piutang berhasil dihapus'
		});
	} catch {
		console.error('Error deleting debt:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
