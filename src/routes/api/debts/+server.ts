import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { debtQueries } from '$lib/server/db/queries';

interface CreateDebtBody {
	type: 'piutang' | 'hutang';
	contact_name: string;
	contact_phone?: string;
	contact_address?: string;
	amount: number;
	date: string;
	due_date?: string;
	description?: string;
}

interface ListDebtsQuery {
	type?: 'piutang' | 'hutang';
	status?: 'active' | 'paid' | 'overdue';
}

// GET /api/debts - Returns all debts for authenticated user
export const GET: RequestHandler = async ({ url, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Parse query parameters
		const type = url.searchParams.get('type') as ListDebtsQuery['type'] | null;
		const status = url.searchParams.get('status') as ListDebtsQuery['status'] | null;
		const includeInactive = url.searchParams.get('include_inactive') === 'true';

		const debts = await debtQueries.findAll(db, userId, {
			type: type ?? undefined,
			status: status ?? undefined,
			includeInactive
		});

		// Map to API response format
		const mappedDebts = debts.map((d) => ({
			id: d.id,
			type: d.type,
			contactName: d.contactName,
			contactPhone: d.contactPhone,
			contactAddress: d.contactAddress,
			originalAmount: d.originalAmount,
			paidAmount: d.paidAmount,
			remainingAmount: d.remainingAmount,
			date: d.date,
			dueDate: d.dueDate,
			description: d.description,
			status: d.status,
			createdAt: d.createdAt,
			updatedAt: d.updatedAt,
			payments: d.payments.map((p) => ({
				id: p.id,
				amount: p.amount,
				date: p.date,
				accountId: p.accountId,
				transactionId: p.transactionId,
				notes: p.notes,
				createdAt: p.createdAt
			}))
		}));

		return json({ debts: mappedDebts });
	} catch {
		console.error('Error fetching debts:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// POST /api/debts - Creates a new debt
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	try {
		const body = (await request.json()) as CreateDebtBody;

		// Validate required fields
		if (!body.type || !['piutang', 'hutang'].includes(body.type)) {
			return json({ error: 'Tipe hutang/piutang wajib diisi (piutang/hutang)' }, { status: 400 });
		}

		if (!body.contact_name || body.contact_name.trim() === '') {
			return json({ error: 'Nama kontak wajib diisi' }, { status: 400 });
		}

		if (body.contact_name.length > 200) {
			return json({ error: 'Nama kontak maksimal 200 karakter' }, { status: 400 });
		}

		if (body.contact_phone && body.contact_phone.length > 20) {
			return json({ error: 'Nomor telepon maksimal 20 karakter' }, { status: 400 });
		}

		if (body.contact_address && body.contact_address.length > 500) {
			return json({ error: 'Alamat maksimal 500 karakter' }, { status: 400 });
		}

		if (body.description && body.description.length > 500) {
			return json({ error: 'Keterangan maksimal 500 karakter' }, { status: 400 });
		}

		const amount = Math.floor(Number(body.amount));
		if (!amount || amount <= 0) {
			return json({ error: 'Jumlah harus lebih dari 0' }, { status: 400 });
		}

		if (!body.date) {
			return json({ error: 'Tanggal wajib diisi' }, { status: 400 });
		}

		// Validate date format (YYYY-MM-DD)
		const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
		if (!dateRegex.test(body.date)) {
			return json({ error: 'Format tanggal harus YYYY-MM-DD' }, { status: 400 });
		}

		// Validate due date format if provided
		if (body.due_date && !dateRegex.test(body.due_date)) {
			return json({ error: 'Format tanggal jatuh tempo harus YYYY-MM-DD' }, { status: 400 });
		}

		const db = getDb();

		// Create the debt
		const debtId = crypto.randomUUID();
		await debtQueries.create(db, {
			userId,
			type: body.type,
			contactName: body.contact_name.trim(),
			contactPhone: body.contact_phone?.trim(),
			contactAddress: body.contact_address?.trim(),
			originalAmount: amount,
			date: body.date,
			dueDate: body.due_date,
			description: body.description?.trim()
		});

		// Fetch the created debt
		const createdDebt = await debtQueries.findById(db, userId, debtId);

		if (!createdDebt) {
			return json({ error: 'Gagal membuat hutang/piutang' }, { status: 500 });
		}

		return json(
			{
				message: body.type === 'piutang' ? 'Piutang berhasil dibuat' : 'Hutang berhasil dibuat',
				debt: {
					id: createdDebt.id,
					type: createdDebt.type,
					contactName: createdDebt.contactName,
					contactPhone: createdDebt.contactPhone,
					contactAddress: createdDebt.contactAddress,
					originalAmount: createdDebt.originalAmount,
					paidAmount: createdDebt.paidAmount,
					remainingAmount: createdDebt.remainingAmount,
					date: createdDebt.date,
					dueDate: createdDebt.dueDate,
					description: createdDebt.description,
					status: createdDebt.status,
					createdAt: createdDebt.createdAt,
					updatedAt: createdDebt.updatedAt
				}
			},
			{ status: 201 }
		);
	} catch {
		console.error('Error creating debt:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
