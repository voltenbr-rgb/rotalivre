CREATE TABLE IF NOT EXISTS `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`courier_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`last_push_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `push_subscriptions_courier_idx` ON `push_subscriptions` (`courier_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `app_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
