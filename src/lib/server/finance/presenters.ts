import type { DebtRecord, PaymentRecord, TransactionRecord } from '$lib/server/finance/repository';
import type { TransferRecord } from '$lib/server/finance/commands';

function timestamp(value: Date | number | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function presentTransaction(item: TransactionRecord) {
	return {
		id: item.id,
		date: item.date,
		type: item.type,
		amount: item.amount,
		description: item.description,
		accountId: item.accountId,
		categoryId: item.categoryId,
		toAccountId: item.toAccountId,
		debtId: item.debtId,
		account: item.account
			? {
					id: item.account.id,
					name: item.account.name,
					code: item.account.code,
					type: item.account.subType
				}
			: null,
		category: item.category
			? {
					id: item.category.id,
					name: item.category.name,
					code: item.category.code,
					icon: item.category.icon,
					color: item.category.color
				}
			: null,
		toAccount: item.toAccount
			? {
					id: item.toAccount.id,
					name: item.toAccount.name,
					code: item.toAccount.code
				}
			: null,
		isTaxed: item.isTaxed,
		taxAmount: item.taxAmount,
		referenceNumber: item.referenceNumber,
		notes: item.notes,
		isActive: item.isActive,
		createdAt: timestamp(item.createdAt),
		updatedAt: timestamp(item.updatedAt)
	};
}

export function presentPayment(item: PaymentRecord) {
	return {
		id: item.id,
		amount: item.amount,
		date: item.date,
		accountId: item.accountId,
		transactionId: item.transactionId,
		notes: item.notes,
		createdAt: timestamp(item.createdAt)
	};
}

export function presentDebt(item: DebtRecord) {
	return {
		id: item.id,
		type: item.type,
		contactName: item.contactName,
		contactPhone: item.contactPhone,
		contactAddress: item.contactAddress,
		originalAmount: item.originalAmount,
		paidAmount: item.paidAmount,
		remainingAmount: item.remainingAmount,
		date: item.date,
		dueDate: item.dueDate,
		description: item.description,
		status: item.status,
		isActive: item.isActive,
		createdAt: timestamp(item.createdAt),
		updatedAt: timestamp(item.updatedAt),
		payments: item.payments.map(presentPayment)
	};
}

export function presentTransfer(item: TransferRecord) {
	return {
		id: item.id,
		date: item.date,
		amount: item.amount,
		description: item.description,
		sourceAccount: {
			id: item.sourceAccount.id,
			name: item.sourceAccount.name,
			code: item.sourceAccount.code
		},
		destinationAccount: {
			id: item.destinationAccount.id,
			name: item.destinationAccount.name,
			code: item.destinationAccount.code
		},
		sourceTransactionId: item.sourceTransaction.id,
		destinationTransactionId: item.destinationTransaction.id,
		createdAt: timestamp(item.sourceTransaction.createdAt)
	};
}
