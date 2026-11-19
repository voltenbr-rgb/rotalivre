CREATE TABLE IF NOT EXISTS `message_audio` (
	`message_id` integer PRIMARY KEY NOT NULL,
	`mime` text NOT NULL,
	`data_b64` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `messages_created_idx` ON `messages` (`created_at`);
