ALTER TABLE `tax_record` ADD `paid_amount` integer;--> statement-breakpoint
-- Before this column, marking a month paid stored the app's estimate as tax_amount and
-- assumed exactly that was paid. Carry that assumption over for existing paid records so a
-- later, higher recomputed tax shows as underpaid.
UPDATE `tax_record` SET `paid_amount` = `tax_amount` WHERE `status` = 'paid';
