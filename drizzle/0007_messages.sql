-- Messages table for user-to-admin feedback, contact, and anonymous messages
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telegram_id` text NOT NULL,
	`sender_name` text,
	`sender_email` text,
	`content` text NOT NULL,
	`rating` integer,
	`is_anonymous` integer DEFAULT false,
	`is_read` integer DEFAULT false,
	`replied` integer DEFAULT false,
	`reply_text` text,
	`replied_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_created` ON `messages` (`created_at` DESC);--> statement-breakpoint
CREATE INDEX `idx_messages_user` ON `messages` (`telegram_id`);
