// IndexedDB Local Storage for Offline-First Operation
//
// This module provides IndexedDB storage using Dexie.js for offline data persistence.
// All CRUD operations write to IndexedDB first (local-first), then queue for sync.
//
// ## Usage
//
// `typescript
// import { db, transactions, accounts, categories } from '$lib/db';
//
// // Create a transaction
// const transaction = await transactions.createTransaction({
//   userId: 'user-123',
//   date: '2024-01-15',
//   type: 'expense',
//   amount: 50000,
//   accountId: 'account-456',
//   categoryId: 'category-789'
// });
//
// // Get transactions
// const list = await transactions.getTransactions('user-123', {
//   startDate: '2024-01-01',
//   endDate: '2024-01-31',
//   type: 'expense'
// });
// `

// Core database
export { db, generateId, now, clearUserData, clearAllData, getRecordCounts, getPendingRecords } from './index';
export type { SyncStatus } from './schema';

// Entity operations
export _ from './transactions';
export _ from './accounts';
export _ from './categories';
export _ from './debts';
export _ from './tax-records';
export _ from './business-profile';

// Sync utilities
export {
getSyncState,
onSyncStateChange,
initSyncListeners,
cleanupSyncListeners,
triggerSync,
getPendingCount,
isOnline
} from './sync';
export type { SyncState } from './sync';

// Storage monitoring
export {
getStorageInfo,
requestPersistentStorage,
isStoragePersisted,
formatBytes,
getStorageStatusMessage,
onStorageWarning,
startStorageMonitoring,
stopStorageMonitoring
} from './usage';
export type { StorageInfo } from './usage';
