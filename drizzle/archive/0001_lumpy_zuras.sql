CREATE TABLE `admins` (
	`telegram_id` integer PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'super_admin' NOT NULL,
	`category_id` integer,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` real,
	`stock` integer DEFAULT 0 NOT NULL,
	`unit` text DEFAULT 'item' NOT NULL,
	`image_url` text,
	`available` integer DEFAULT true,
	`featured` integer DEFAULT false,
	`price_on_request` integer DEFAULT false,
	`is_seasonal` integer DEFAULT false,
	`size_options` text,
	`syrup_options` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "branch_id", "category_id", "name", "description", "price", "stock", "unit", "image_url", "available", "featured", "price_on_request", "is_seasonal", "size_options", "syrup_options", "created_at", "updated_at") SELECT "id", "branch_id", "category_id", "name", "description", "price", "stock", "unit", "image_url", "available", "featured", "price_on_request", "is_seasonal", "size_options", "syrup_options", "created_at", "updated_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `categories` ADD `emoji` text;--> statement-breakpoint
ALTER TABLE `categories` ADD `sort_order` integer DEFAULT 0;