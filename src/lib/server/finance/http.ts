import { json } from '@sveltejs/kit';
import { FinanceError } from './contracts';

export function financeErrorResponse(error: unknown, operation: string): Response {
	if (error instanceof FinanceError) {
		return json({ error: error.message, code: error.code }, { status: error.status });
	}
	console.error(`Financial command failed: ${operation}`, error);
	return json({ error: 'Terjadi kesalahan server', code: 'INTERNAL_ERROR' }, { status: 500 });
}
