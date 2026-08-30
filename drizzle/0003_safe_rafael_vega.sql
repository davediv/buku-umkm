CREATE TABLE `financial_command` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`kind` text NOT NULL,
	`result` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_command_user_key_unique` ON `financial_command` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `financial_command_user_created_idx` ON `financial_command` (`user_id`,`created_at`);