CREATE TABLE IF NOT EXISTS `couriers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`is_main` integer NOT NULL DEFAULT 0,
	`name` text NOT NULL,
	`nickname` text NOT NULL DEFAULT '',
	`email` text NOT NULL DEFAULT '',
	`phone` text NOT NULL DEFAULT '',
	`cpf` text NOT NULL DEFAULT '',
	`birth_date` text NOT NULL DEFAULT '',
	`photo_url` text NOT NULL DEFAULT '',
	`status` text NOT NULL DEFAULT 'online',
	`vehicle_model` text NOT NULL DEFAULT '',
	`vehicle_plate` text NOT NULL DEFAULT '',
	`vehicle_year` text NOT NULL DEFAULT '',
	`vehicle_color` text NOT NULL DEFAULT '',
	`cnh_number` text NOT NULL DEFAULT '',
	`cnh_category` text NOT NULL DEFAULT 'AB',
	`cnh_expiry` text NOT NULL DEFAULT '',
	`cep` text NOT NULL DEFAULT '',
	`street` text NOT NULL DEFAULT '',
	`number` text NOT NULL DEFAULT '',
	`neighborhood` text NOT NULL DEFAULT '',
	`city` text NOT NULL DEFAULT '',
	`state` text NOT NULL DEFAULT '',
	`work_radius_km` integer NOT NULL DEFAULT 8,
	`daily_goal` real NOT NULL DEFAULT 250,
	`base_lat` real NOT NULL DEFAULT -23.6461,
	`base_lng` real NOT NULL DEFAULT -46.7678,
	`rating` real NOT NULL DEFAULT 4.9,
	`total_deliveries` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`client_name` text NOT NULL,
	`establishment` text NOT NULL,
	`establishment_type` text NOT NULL DEFAULT 'Restaurante',
	`pickup_address` text NOT NULL,
	`pickup_neighborhood` text NOT NULL,
	`pickup_lat` real NOT NULL,
	`pickup_lng` real NOT NULL,
	`delivery_address` text NOT NULL,
	`delivery_neighborhood` text NOT NULL,
	`delivery_lat` real NOT NULL,
	`delivery_lng` real NOT NULL,
	`distance_km` real NOT NULL,
	`value_net` real NOT NULL,
	`eta_minutes` integer NOT NULL DEFAULT 25,
	`items_count` integer NOT NULL DEFAULT 1,
	`payment_method` text NOT NULL DEFAULT 'Pix',
	`status` text NOT NULL DEFAULT 'available',
	`courier_id` integer,
	`created_at` integer NOT NULL,
	`accepted_at` integer,
	`picked_up_at` integer,
	`delivered_at` integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`courier_id` integer NOT NULL,
	`order_id` integer,
	`type` text NOT NULL DEFAULT 'entrega',
	`description` text NOT NULL DEFAULT '',
	`amount_gross` real NOT NULL DEFAULT 0,
	`fee_amount` real NOT NULL DEFAULT 0,
	`amount_net` real NOT NULL DEFAULT 0,
	`km` real NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`courier_id` integer NOT NULL,
	`channel` text NOT NULL DEFAULT 'Zona Sul',
	`kind` text NOT NULL DEFAULT 'texto',
	`alert_type` text,
	`content` text NOT NULL DEFAULT '',
	`audio_duration_sec` integer,
	`neighborhood` text NOT NULL DEFAULT '',
	`lat` real,
	`lng` real,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `orders_status_idx` ON `orders` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_courier_created_idx` ON `transactions` (`courier_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `messages_channel_created_idx` ON `messages` (`channel`, `created_at`);
