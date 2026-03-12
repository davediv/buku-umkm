CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`sub_type` text,
	`is_system` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`parent_id` text,
	`balance` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `account_code_idx` ON `account` (`code`);--> statement-breakpoint
CREATE INDEX `account_type_idx` ON `account` (`type`);--> statement-breakpoint
CREATE TABLE `backup` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`r2_key` text NOT NULL,
	`record_count` integer NOT NULL,
	`includes` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `backup_userId_idx` ON `backup` (`user_id`);--> statement-breakpoint
CREATE INDEX `backup_type_idx` ON `backup` (`type`);--> statement-breakpoint
CREATE INDEX `backup_status_idx` ON `backup` (`status`);--> statement-breakpoint
CREATE TABLE `business_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`phone` text,
	`npwp` text,
	`business_type` text NOT NULL,
	`owner_name` text,
	`industry` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`icon` text,
	`color` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `category_userId_idx` ON `category` (`user_id`);--> statement-breakpoint
CREATE INDEX `category_code_idx` ON `category` (`code`);--> statement-breakpoint
CREATE INDEX `category_type_idx` ON `category` (`type`);--> statement-breakpoint
CREATE TABLE `debt` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_phone` text,
	`contact_address` text,
	`original_amount` integer NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`remaining_amount` integer NOT NULL,
	`date` text NOT NULL,
	`due_date` text,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `debt_userId_idx` ON `debt` (`user_id`);--> statement-breakpoint
CREATE INDEX `debt_type_idx` ON `debt` (`type`);--> statement-breakpoint
CREATE INDEX `debt_status_idx` ON `debt` (`status`);--> statement-breakpoint
CREATE INDEX `debt_dueDate_idx` ON `debt` (`due_date`);--> statement-breakpoint
CREATE TABLE `debt_payment` (
	`id` text PRIMARY KEY NOT NULL,
	`debt_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`account_id` text NOT NULL,
	`transaction_id` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`debt_id`) REFERENCES `debt`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transaction`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `debtPayment_debtId_idx` ON `debt_payment` (`debt_id`);--> statement-breakpoint
CREATE INDEX `debtPayment_userId_idx` ON `debt_payment` (`user_id`);--> statement-breakpoint
CREATE INDEX `debtPayment_date_idx` ON `debt_payment` (`date`);--> statement-breakpoint
CREATE TABLE `tax_record` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer,
	`tax_type` text NOT NULL,
	`taxable_income` integer NOT NULL,
	`tax_rate` integer NOT NULL,
	`tax_amount` integer NOT NULL,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`billing_code` text,
	`payment_date` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `taxRecord_userId_idx` ON `tax_record` (`user_id`);--> statement-breakpoint
CREATE INDEX `taxRecord_year_idx` ON `tax_record` (`year`);--> statement-breakpoint
CREATE INDEX `taxRecord_month_idx` ON `tax_record` (`month`);--> statement-breakpoint
CREATE INDEX `taxRecord_status_idx` ON `tax_record` (`status`);--> statement-breakpoint
CREATE TABLE `transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`description` text,
	`account_id` text NOT NULL,
	`to_account_id` text,
	`category_id` text,
	`debt_id` text,
	`is_taxed` integer DEFAULT false NOT NULL,
	`tax_amount` integer DEFAULT 0 NOT NULL,
	`reference_number` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`debt_id`) REFERENCES `debt`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `transaction_userId_idx` ON `transaction` (`user_id`);--> statement-breakpoint
CREATE INDEX `transaction_date_idx` ON `transaction` (`date`);--> statement-breakpoint
CREATE INDEX `transaction_type_idx` ON `transaction` (`type`);--> statement-breakpoint
CREATE INDEX `transaction_accountId_idx` ON `transaction` (`account_id`);--> statement-breakpoint
CREATE TABLE `transaction_photo` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`user_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`r2_key` text NOT NULL,
	`r2_url` text,
	`caption` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transaction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transactionPhoto_transactionId_idx` ON `transaction_photo` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `transactionPhoto_userId_idx` ON `transaction_photo` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_extension` (
	`id` text PRIMARY KEY NOT NULL,
	`npwp` text,
	`npwp_type` text,
	`business_name` text,
	`business_type` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);