ALTER TABLE `couriers` ADD `password_hash` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_type` text NOT NULL DEFAULT 'courier',
	`account_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sessions_account_idx` ON `sessions` (`account_type`, `account_id`);
