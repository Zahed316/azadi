-- Phase 5.2: per-user product favorites
-- Implicit identity by Telegram user_id (cast to text).
-- See ~/plans/phase-5-streak-favorites.md for the design slice.

CREATE TABLE favorites (
  telegram_id TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (telegram_id, product_id)
);

-- "My favorites" list query: WHERE telegram_id = ? ORDER BY created_at DESC
CREATE INDEX idx_favorites_user ON favorites(telegram_id, created_at DESC);
