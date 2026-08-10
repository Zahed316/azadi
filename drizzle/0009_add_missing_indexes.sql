-- Additional performance indexes not covered by 0008_indexes.sql.
-- Uses IF NOT EXISTS for idempotency.

-- Favorites: per-user list query (WHERE telegram_id = ? ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS `idx_favorites_telegram_id` ON `favorites` (`telegram_id`);

-- User state: streak sweep query (WHERE last_seen_at < cutoff)
CREATE INDEX IF NOT EXISTS `idx_user_state_last_seen` ON `user_state` (`last_seen_at`);

-- Messages: admin replied filter (WHERE replied = false)
CREATE INDEX IF NOT EXISTS `idx_messages_replied` ON `messages` (`replied`);
