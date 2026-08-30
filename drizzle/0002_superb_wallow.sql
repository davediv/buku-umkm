CREATE TABLE `onboarding_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`completed_at` integer,
	`skipped_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
