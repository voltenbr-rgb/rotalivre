CREATE TABLE IF NOT EXISTS `message_photo` (
	`message_id` integer PRIMARY KEY NOT NULL,
	`mime` text NOT NULL,
	`data_b64` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `message_photo_created_idx` ON `message_photo` (`created_at`);
