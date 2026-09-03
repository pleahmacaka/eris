CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`collection` text NOT NULL,
	`id` text NOT NULL,
	`seq` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`device_id` text NOT NULL,
	`data` text,
	PRIMARY KEY(`collection`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `records_seq_unique` ON `records` (`seq`);