-- Existing debts were all credit sales/purchases, so they become 'trade'.
ALTER TABLE `debt` ADD `kind` text DEFAULT 'trade' NOT NULL;--> statement-breakpoint
-- drizzle-kit omits ON DELETE for added columns; SET NULL matches the schema, and lets
-- restore delete a user's transactions before their debts.
ALTER TABLE `debt` ADD `principal_account_id` text REFERENCES `chart_of_account`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
ALTER TABLE `debt` ADD `principal_transaction_id` text REFERENCES `transaction`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
CREATE INDEX `debt_principalTransactionId_idx` ON `debt` (`principal_transaction_id`);
