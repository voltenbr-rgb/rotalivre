ALTER TABLE `orders` ADD `delivery_code` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_code_attempts` integer NOT NULL DEFAULT 0;
