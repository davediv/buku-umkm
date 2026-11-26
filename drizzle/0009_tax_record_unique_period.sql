-- A double-submitted mark-paid could store two records for one tax period. Keep the most
-- recently updated record of each (user, year, month, tax type) so the unique index can be
-- created. Rows without a month (annual records) are not constrained by the index (SQLite
-- treats NULLs as distinct), so they are left alone.
DELETE FROM `tax_record`
WHERE `month` IS NOT NULL
	AND `id` IN (
		SELECT `id` FROM (
			SELECT
				`id`,
				ROW_NUMBER() OVER (
					PARTITION BY `user_id`, `year`, `month`, `tax_type`
					ORDER BY `updated_at` DESC, `created_at` DESC, `rowid` DESC
				) AS `position`
			FROM `tax_record`
			WHERE `month` IS NOT NULL
		)
		WHERE `position` > 1
	);
--> statement-breakpoint
DROP INDEX `tax_record_userId_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `tax_record_user_period_type_unique` ON `tax_record` (`user_id`,`year`,`month`,`tax_type`);
