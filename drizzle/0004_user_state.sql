-- Phase 5.1: per-user streak counter state
-- Implicit identity by Telegram user_id (cast to text), no signup.
-- See ~/plans/phase-5-streak-favorites.md for the design slice.

CREATE TABLE user_state (
  telegram_id TEXT PRIMARY KEY,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  visits_total INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_quiz_at INTEGER
);

-- Cron sweep: WHERE last_seen_at < now - 48h
CREATE INDEX idx_user_state_last_seen ON user_state(last_seen_at);
