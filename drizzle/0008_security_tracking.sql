ALTER TABLE `couriers` ADD `blocked` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `couriers` ADD `terms_accepted_at` integer;
--> statement-breakpoint
ALTER TABLE `stores` ADD `blocked` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `stores` ADD `terms_accepted_at` integer;
--> statement-breakpoint
ALTER TABLE `orders` ADD `public_token` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `renotified_at` integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `orders_public_token_unique` ON `orders` (`public_token`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `login_guard` (
	`key` text PRIMARY KEY NOT NULL,
	`fails` integer NOT NULL DEFAULT 0,
	`locked_until` integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `support_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_type` text NOT NULL,
	`email` text NOT NULL,
	`contact` text NOT NULL DEFAULT '',
	`message` text NOT NULL DEFAULT '',
	`kind` text NOT NULL DEFAULT 'senha',
	`status` text NOT NULL DEFAULT 'aberto',
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
