import { daysBetween, paymentDueDate } from './deadline';
import { reconcilePayment, type PaymentRecordLike } from './payments';
import type { CalendarDay } from './period';

export interface ReminderPeriod {
	year: number;
	months: number[];
}

/**
 * The tax months the reminder checks: every earlier month of the current year, or, in
 * January, December of the previous year.
 */
export function reminderPeriod(today: CalendarDay): ReminderPeriod {
	if (today.month === 1) return { year: today.year - 1, months: [12] };
	return { year: today.year, months: Array.from({ length: today.month - 1 }, (_, i) => i + 1) };
}

export interface OutstandingMonth {
	year: number;
	month: number;
	status: 'unpaid' | 'underpaid';
	/** Tax recomputed from today's books. */
	taxAmount: number;
	paidAmount: number | null;
	outstandingAmount: number;
	dueDate: string;
	/** Negative once the due date has passed. */
	daysUntilDue: number;
	billingCodeUrl: string;
}

/** Months in the period whose recomputed tax is unpaid or only partly paid, oldest first. */
export function findOutstandingMonths(input: {
	year: number;
	months: number[];
	/** Recomputed tax per month, January at index 0. */
	monthlyTax: number[];
	records: (PaymentRecordLike & { month: number | null })[];
	today: string;
}): OutstandingMonth[] {
	const recordByMonth = new Map(input.records.map((record) => [record.month, record]));
	const outstanding: OutstandingMonth[] = [];
	for (const month of input.months) {
		const taxAmount = input.monthlyTax[month - 1] ?? 0;
		const payment = reconcilePayment(taxAmount, recordByMonth.get(month));
		if (payment.status !== 'unpaid' && payment.status !== 'underpaid') continue;
		const dueDate = paymentDueDate(input.year, month);
		outstanding.push({
			year: input.year,
			month,
			status: payment.status,
			taxAmount,
			paidAmount: payment.paidAmount,
			outstandingAmount: payment.outstandingAmount,
			dueDate,
			daysUntilDue: daysBetween(input.today, dueDate),
			billingCodeUrl: `/pajak/kode-billing/${input.year}/${month}`
		});
	}
	return outstanding;
}

/** High once any month is overdue or due within 5 days; medium within 10 days. */
export function reminderUrgency(items: OutstandingMonth[]): 'low' | 'medium' | 'high' {
	const soonest = Math.min(...items.map((item) => item.daysUntilDue));
	if (soonest <= 5) return 'high';
	if (soonest <= 10) return 'medium';
	return 'low';
}
