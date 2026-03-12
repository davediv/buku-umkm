import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { debtQueries, chartOfAccountQueries } from '$lib/server/db/queries';

export const load: PageServerLoad = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/login');
	}

	const userId = locals.user.id;
	const debtId = params.id;

	if (!debtId) {
		throw error(400, 'ID hutang/piutang diperlukan');
	}

	const db = getDb();

	try {
		// Get debt with payments
		const debt = await debtQueries.findById(db, userId, debtId, { includeInactive: true });

		if (!debt) {
			throw error(404, 'Hutang/piutang tidak ditemukan');
		}

		// Get all accounts for payment form dropdown
		const accounts = await chartOfAccountQueries.findAll(db, userId);

		// Format debt data for display
		const formattedDebt = {
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
			isActive: debt.isActive,
			createdAt: debt.createdAt,
			updatedAt: debt.updatedAt
		};

		// Format payments for display
		const payments = debt.payments.map((p) => ({
			id: p.id,
			amount: p.amount,
			date: p.date,
			accountId: p.accountId,
			notes: p.notes,
			createdAt: p.createdAt
		}));

		// Filter accounts for payment type:
		// - Piutang payment: money comes IN (use income accounts like "Kas", "Bank")
		// - Hutang payment: money goes OUT (use expense accounts like "Kas", "Bank")
		// Both can use cash/bank accounts (type: asset)
		const paymentAccounts = accounts.filter((a) => a.type === 'asset');

		return {
			debt: formattedDebt,
			payments,
			accounts: paymentAccounts
		};
	} catch (err) {
		console.error('Error loading debt detail:', err);
		throw error(500, 'Terjadi kesalahan server');
	}
};
