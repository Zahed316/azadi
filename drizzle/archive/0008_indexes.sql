-- Add indexes defined in Drizzle schema for query performance.
-- Uses IF NOT EXISTS for idempotency (hand-crafted indexes in 0004/0005/0007
-- may already exist in D1).

-- Products: common filter and listing columns
CREATE INDEX IF NOT EXISTS `idx_products_category` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_products_available` ON `products` (`available`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_products_featured` ON `products` (`featured`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_products_seasonal` ON `products` (`is_seasonal`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_products_cat_avail` ON `products` (`category_id`, `available`);--> statement-breakpoint

-- AI conversation logs: user history lookup
CREATE INDEX IF NOT EXISTS `idx_ai_logs_user_ts` ON `ai_conversation_logs` (`user_id`, `timestamp`);--> statement-breakpoint

-- Messages: unread filter and user lookup
CREATE INDEX IF NOT EXISTS `idx_messages_unread` ON `messages` (`is_read`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_messages_created` ON `messages` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_messages_user` ON `messages` (`telegram_id`);
