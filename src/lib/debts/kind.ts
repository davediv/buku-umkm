export type DebtKind = 'trade' | 'loan';

/**
 * How a debt reads to the user. Trade debts are credit sales and purchases, counted as
 * revenue or expense when recorded; loans are money lent or borrowed, never counted.
 */
export function debtKindLabel(type: string, kind: string): string {
	if (kind === 'loan') {
		return type === 'piutang' ? 'Pinjaman yang diberikan' : 'Pinjaman yang diterima';
	}
	return type === 'piutang' ? 'Piutang usaha' : 'Utang usaha';
}
