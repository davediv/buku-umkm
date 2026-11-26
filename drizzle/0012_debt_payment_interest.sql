-- Existing payments were principal only.
ALTER TABLE `debt_payment` ADD `interest_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- drizzle-kit omits ON DELETE for added columns; SET NULL matches the schema, and lets
-- restore delete a user's transactions before their payments.
ALTER TABLE `debt_payment` ADD `interest_transaction_id` text REFERENCES `transaction`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
CREATE INDEX `debt_payment_interestTransactionId_idx` ON `debt_payment` (`interest_transaction_id`);
