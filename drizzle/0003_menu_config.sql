-- 0003_menu_config.sql
-- Hand-crafted migration: apply via wrangler d1 execute
-- Safe to re-run: CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS `menu_config` (
  `id`              INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `category_id`     INTEGER NOT NULL REFERENCES `categories`(`id`) ON DELETE CASCADE,
  `menu_section`    TEXT NOT NULL,        -- 'drinks' | 'beans' | 'cakes' | 'extras'
  `display_order`   INTEGER DEFAULT 0 NOT NULL,
  `is_visible`      INTEGER DEFAULT 1 NOT NULL,  -- 1=show, 0=hide in bot
  `button_label`    TEXT,                 -- NULL = use category emoji+name
  `special_message` TEXT,                 -- NULL = generic; set for e.g. pour-over
  `created_at`      INTEGER NOT NULL,
  `updated_at`      INTEGER NOT NULL
);

-- Seed: current hardcoded state (IDs validated against live D1)
INSERT INTO `menu_config`
  (`category_id`, `menu_section`, `display_order`, `is_visible`, `created_at`, `updated_at`)
VALUES
  (1,  'drinks', 1, 1, unixepoch(), unixepoch()),
  (2,  'drinks', 2, 1, unixepoch(), unixepoch()),
  (3,  'drinks', 3, 1, unixepoch(), unixepoch()),
  (4,  'drinks', 4, 1, unixepoch(), unixepoch()),
  (5,  'drinks', 5, 1, unixepoch(), unixepoch()),
  (6,  'drinks', 6, 1, unixepoch(), unixepoch()),
  (7,  'drinks', 7, 1, unixepoch(), unixepoch()),
  (8,  'cakes',  1, 1, unixepoch(), unixepoch()),
  (9,  'beans',  1, 1, unixepoch(), unixepoch()),
  (10, 'extras', 1, 0, unixepoch(), unixepoch());  -- hidden: no bot slot for 'extras' yet

-- Preserve pour-over special message for category 7
UPDATE `menu_config`
SET `special_message` = '☕ <b>قهوه‌های دمی تخصصی</b>

برای اطلاع از قهوه‌های دمی تخصصی امروز از باریستا سوال کنید.

<i>تمامی قیمت‌ها شامل ۱۰٪ مالیات بر ارزش افزوده می‌باشند.</i>'
WHERE `category_id` = 7;
