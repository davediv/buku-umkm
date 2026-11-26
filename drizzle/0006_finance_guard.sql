CREATE TABLE `finance_guard` (
	`ok` integer NOT NULL
);

--> statement-breakpoint
-- Lets a D1 batch assert a condition atomically: batchGuard() inserts ok = 1 when the
-- condition holds (the row is dropped) or ok = 0 when it does not (the batch aborts).
-- D1 rejects BEGIN/SAVEPOINT, so this replaces read-check-write inside a transaction.
CREATE TRIGGER `finance_guard_check` BEFORE INSERT ON `finance_guard`
BEGIN
	SELECT CASE
		WHEN NEW.`ok` = 1 THEN RAISE(IGNORE)
		ELSE RAISE(ABORT, 'BUKU_GUARD_FAILED')
	END;
END;
