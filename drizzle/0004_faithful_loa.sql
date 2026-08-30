ALTER TABLE `chart_of_account` ADD `opening_balance` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `chart_of_account` ADD `opening_date` text;--> statement-breakpoint
UPDATE `chart_of_account`
SET
	`opening_balance` = `balance` - COALESCE(
		(
			SELECT SUM(
				CASE
					WHEN `transaction`.`type` = 'income' THEN `transaction`.`amount`
					WHEN `transaction`.`type` = 'expense' THEN -`transaction`.`amount`
					ELSE 0
				END
			)
			FROM `transaction`
			WHERE `transaction`.`account_id` = `chart_of_account`.`id`
				AND `transaction`.`is_active` = 1
		),
		0
	),
	`opening_date` = MIN(
		date(`created_at` / 1000, 'unixepoch'),
		COALESCE(
			(
				SELECT MIN(`transaction`.`date`)
				FROM `transaction`
				WHERE `transaction`.`account_id` = `chart_of_account`.`id`
					AND `transaction`.`is_active` = 1
			),
			date(`created_at` / 1000, 'unixepoch')
		)
	);
