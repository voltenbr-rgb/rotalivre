CREATE TABLE IF NOT EXISTS `stores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL DEFAULT '',
	`category` text NOT NULL DEFAULT 'Restaurante',
	`phone` text NOT NULL DEFAULT '',
	`address` text NOT NULL DEFAULT '',
	`neighborhood` text NOT NULL DEFAULT '',
	`city` text NOT NULL DEFAULT '',
	`lat` real,
	`lng` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `stores_email_unique` ON `stores` (`email`);
--> statement-breakpoint
ALTER TABLE `couriers` ADD `vehicle_type` text NOT NULL DEFAULT 'moto';
--> statement-breakpoint
ALTER TABLE `orders` ADD `store_id` integer;
--> statement-breakpoint
ALTER TABLE `orders` ADD `accepted_vehicles` text NOT NULL DEFAULT 'todos';
--> statement-breakpoint
ALTER TABLE `orders` ADD `client_phone` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `orders` ADD `notes` text NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `orders_store_idx` ON `orders` (`store_id`);
