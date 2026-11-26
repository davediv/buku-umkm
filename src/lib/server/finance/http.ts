import { json } from '@sveltejs/kit';
import { FinanceError } from './contracts';
import { summarizeError } from '$lib/server/error-summary';

export function financeErrorResponse(error: unknown, operation: string): Response {
	if (error instanceof FinanceError) {
		return json({ error: error.message, code: error.code }, { status: error.status });
	}
	// Never the error itself: a Drizzle query error's message holds every bound parameter
	// (contact names, phone numbers, addresses, notes).
	console.error(`Financial command failed: ${operation}`, summarizeError(error));
	return json({ error: 'Terjadi kesalahan server', code: 'INTERNAL_ERROR' }, { status: 500 });
}
