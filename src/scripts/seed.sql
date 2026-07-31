-- Truncate old data
DELETE FROM coffee_details; DELETE FROM products; DELETE FROM categories;

-- Categories (IDs explicit to match product inserts)
INSERT INTO categories (id, name, description, emoji, sort_order) VALUES
  (1, 'Hot Coffee',           'Espresso-based hot drinks',       '🔥', 1),
  (9, 'Coffee Beans',         'Single-origin and blended beans', '🌱', 9),
  (10, 'Equipment',            'Brewing equipment',               '🛠️', 10),
  (4, 'Tea & Herbal Tea',     'Black, green, and herbal teas',   '🍵', 2),
  (5, 'Cold Coffee',          'Cold brew, iced lattes',          '🧊', 3),
  (6, 'Smoothies & Refreshers','Fresh blended drinks',           '🥤', 4),
  (7, 'Specialty Brew Coffee','Pour-over, Aeropress, Chemex',    '☕', 5),
  (8, 'Cakes & Cookies',      'Freshly baked daily',             '🍰', 6);

-- Hot Coffee (cat 1)
INSERT INTO products (category_id, name, description, price, stock, unit, available, featured, created_at, updated_at) VALUES
  (1, 'Espresso',       'Single / Double', 85,  999, 'cup', 1, 1, unixepoch(), unixepoch()),
  (1, 'Americano',      '',                150, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (1, 'Cappuccino',     '',                170, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (1, 'Latte',          'Add syrup +20',   190, 999, 'cup', 1, 1, unixepoch(), unixepoch()),
  (1, 'Hot Chocolate',  '',                170, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (1, 'Masala',         '',                180, 999, 'cup', 1, 0, unixepoch(), unixepoch());

-- Tea (cat 4)
INSERT INTO products (category_id, name, description, price, stock, unit, available, featured, created_at, updated_at) VALUES
  (4, 'Black Tea',          '',               90,  999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (4, 'Green Tea',          '',               120, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (4, 'Herbal — Apple Paradise',   '',        170, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (4, 'Herbal — Lemongrass Ginger','',        170, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (4, 'Herbal — Victoria Sunset',  '',        170, 999, 'cup', 1, 0, unixepoch(), unixepoch());

-- Cold Coffee (cat 5)
INSERT INTO products (category_id, name, description, price, price_on_request, stock, unit, available, featured, created_at, updated_at) VALUES
  (5, 'Iced Americano', '',                    160,  0, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (5, 'Iced Latte',     'Add syrup +20',       200,  0, 999, 'cup', 1, 1, unixepoch(), unixepoch()),
  (5, 'Cold Brew',      'Ask in store',        NULL, 1, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (5, 'Affogato',       'Espresso over ice cream', 195, 0, 999, 'cup', 1, 0, unixepoch(), unixepoch());

-- Smoothies (cat 6)
INSERT INTO products (category_id, name, description, price, is_seasonal, stock, unit, available, featured, created_at, updated_at) VALUES
  (6, 'Seasonal Smoothie',         'Changes weekly',  200, 1, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (6, 'Lotus Shake',               '',                220, 0, 999, 'cup', 1, 1, unixepoch(), unixepoch()),
  (6, 'Berry Shake',               '',                220, 0, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (6, 'Refresher — Mango',         '',                280, 0, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (6, 'Refresher — Mulberry',      '',                280, 0, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (6, 'Refresher — Pineapple',     '',                280, 0, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (6, 'Refresher — Strawberry',    '',                280, 0, 999, 'cup', 1, 0, unixepoch(), unixepoch());

-- Specialty Brew (cat 7) — empty by default, shown as "Ask barista"

-- Cakes & Cookies (cat 8)
INSERT INTO products (category_id, name, description, price, stock, unit, available, featured, created_at, updated_at) VALUES
  (8, 'Cake of the Day', 'Ask in store for today''s selection', 220, 10, 'slice', 1, 1, unixepoch(), unixepoch()),
  (8, 'Cookie',          '',                                    95,  50, 'piece', 1, 0, unixepoch(), unixepoch());

-- Branches (re-add since we truncated earlier maybe not, wait we didn't truncate branches)
-- Actually let's just keep the original branches and FAQ seed parts just in case
-- Branches
INSERT INTO branches (name, address, phone, opening_hours, is_active) VALUES
  ('شعبه اصلی - ایرانشهر', 'ایرانشهر، خیابان اصلی', '054-XXXXXXXX', '8:00 - 22:00', 1),
  ('شعبه دوم', 'آدرس شعبه دوم', '054-XXXXXXXX', '9:00 - 21:00', 1);

-- FAQ
INSERT INTO faq (question, answer) VALUES
  ('آیا قهوه تازه برشته دارید؟', 'بله، قهوه‌های ما هفته‌ای یک‌بار تازه برشته می‌شوند.'),
  ('آیا امکان ارسال دارید؟', 'بله، برای سفارش‌های بالای ۵۰۰ هزار تومان ارسال رایگان داریم.');
