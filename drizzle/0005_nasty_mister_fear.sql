CREATE TABLE `tax_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tax_year` integer NOT NULL,
	`legal_form` text NOT NULL,
	`registered_at` text NOT NULL,
	`final_regime_start_year` integer NOT NULL,
	`regime_choice` text NOT NULL,
	`ever_used_general_regime` integer DEFAULT false NOT NULL,
	`prior_year_aggregated_revenue` integer DEFAULT 0 NOT NULL,
	`external_monthly_revenue` text DEFAULT '[]' NOT NULL,
	`revenue_data_complete` integer DEFAULT false NOT NULL,
	`aggregation_confirmed` integer DEFAULT false NOT NULL,
	`has_professional_service_income` integer DEFAULT false NOT NULL,
	`sole_owner_provides_professional_services` integer DEFAULT false NOT NULL,
	`uses_other_tax_facility` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_profile_user_year_unique` ON `tax_profile` (`user_id`,`tax_year`);--> statement-breakpoint
CREATE INDEX `tax_profile_user_idx` ON `tax_profile` (`user_id`);--> statement-breakpoint
CREATE INDEX `tax_profile_year_idx` ON `tax_profile` (`tax_year`);