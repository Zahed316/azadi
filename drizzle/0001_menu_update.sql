-- Add emoji + sortOrder to categories
ALTER TABLE categories ADD COLUMN emoji text;
ALTER TABLE categories ADD COLUMN sort_order integer DEFAULT 0;

-- Recreate products table to make price nullable and add new columns
CREATE TABLE `products_new` (
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

INSERT INTO `products_new` (`id`, `branch_id`, `category_id`, `name`, `description`, `price`, `stock`, `unit`, `image_url`, `available`, `featured`, `created_at`, `updated_at`)
SELECT `id`, `branch_id`, `category_id`, `name`, `description`, `price`, `stock`, `unit`, `image_url`, `available`, `featured`, `created_at`, `updated_at` FROM `products`;

DROP TABLE `products`;
ALTER TABLE `products_new` RENAME TO `products`;
