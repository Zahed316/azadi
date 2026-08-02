-- Truncate old data (order matters: delete children before parents)
DELETE FROM coffee_details; DELETE FROM products; DELETE FROM menu_config; DELETE FROM categories; DELETE FROM branches; DELETE FROM faq;

-- Categories (IDs explicit to match product inserts)
INSERT INTO categories (id, name, description, emoji, sort_order) VALUES
  (1, 'قهوه گرم',           'نوشیدنی‌های گرم بر پایه اسپرسو',       '🔥', 1),
  (9, 'دانه‌های قهوه',         'قهوه‌های تک‌خاستگاه و بلند', '🌱', 9),
  (10, 'تجهیزات',            'تجهیزات دم‌آوری',               '🛠️', 10),
  (4, 'چای و دمنوش',     'چای سیاه، سبز و دمنوش',   '🍵', 2),
  (5, 'قهوه سرد',          'کلد برو و لاته یخی',          '🧊', 3),
  (6, 'اسموتی و نوشیدنی‌های خنک','نوشیدنی‌های تازه و خنک',           '🥤', 4),
  (7, 'قهوه‌های دمی تخصصی','پوراوور، ایروپرس و کمکس',    '☕', 5),
  (8, 'کیک و کوکی',      'هر روز تازه پخته می‌شود',             '🍰', 6);

-- Hot Coffee (cat 1)
INSERT INTO products (category_id, name, description, price, stock, unit, available, featured, created_at, updated_at) VALUES
  (1, 'اسپرسو',       'تکی / دوبل', 85,  999, 'cup', 1, 1, unixepoch(), unixepoch()),
  (1, 'آمریکانو',      '',                150, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (1, 'کاپوچینو',     '',                170, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (1, 'لاته',          'افزودن سیروپ ۲۰+',   190, 999, 'cup', 1, 1, unixepoch(), unixepoch()),
  (1, 'هات چاکلت',  '',                170, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (1, 'ماسالا',         '',                180, 999, 'cup', 1, 0, unixepoch(), unixepoch());

-- Tea (cat 4)
INSERT INTO products (category_id, name, description, price, stock, unit, available, featured, created_at, updated_at) VALUES
  (4, 'چای سیاه',          '',               90,  999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (4, 'چای سبز',          '',               120, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (4, 'دمنوش — بهشت سیب',   '',        170, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (4, 'دمنوش — لمونگراس و زنجبیل','',        170, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (4, 'دمنوش — غروب ویکتوریا',  '',        170, 999, 'cup', 1, 0, unixepoch(), unixepoch());

-- Cold Coffee (cat 5)
INSERT INTO products (category_id, name, description, price, price_on_request, stock, unit, available, featured, created_at, updated_at) VALUES
  (5, 'آمریکانو یخ', '',                    160,  0, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (5, 'لاته یخ',     'افزودن سیروپ ۲۰+',       200,  0, 999, 'cup', 1, 1, unixepoch(), unixepoch()),
  (5, 'کلد برو',      'سوال در کافه',        NULL, 1, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (5, 'افوگاتو',       'اسپرسو روی بستنی', 195, 0, 999, 'cup', 1, 0, unixepoch(), unixepoch());

-- Smoothies (cat 6)
INSERT INTO products (category_id, name, description, price, is_seasonal, stock, unit, available, featured, created_at, updated_at) VALUES
  (6, 'اسموتی فصلی',         'هر هفته عوض می‌شود',  200, 1, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (6, 'شیک لوتوس',               '',                220, 0, 999, 'cup', 1, 1, unixepoch(), unixepoch()),
  (6, 'شیک توت',               '',                220, 0, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (6, 'ریفرشر — انبه',         '',                280, 0, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (6, 'ریفرشر — توت',      '',                280, 0, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (6, 'ریفرشر — آناناس',     '',                280, 0, 999, 'cup', 1, 0, unixepoch(), unixepoch()),
  (6, 'ریفرشر — توت فرنگی',    '',                280, 0, 999, 'cup', 1, 0, unixepoch(), unixepoch());

-- Specialty Brew (cat 7) — empty by default, shown as "Ask barista"

-- Cakes & Cookies (cat 8)
INSERT INTO products (category_id, name, description, price, stock, unit, available, featured, created_at, updated_at) VALUES
  (8, 'کیک روز', 'برای اطلاع از کیک امروز از کافه بپرسید', 220, 10, 'slice', 1, 1, unixepoch(), unixepoch()),
  (8, 'کوکی',          '',                                    95,  50, 'piece', 1, 0, unixepoch(), unixepoch());

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

-- Settings (initial values for the Mini App Settings tab)
INSERT INTO settings (key, value) VALUES
  ('about', 'به کافه آزادی خوش آمدید! ما یک رستری محلی با دو شعبه هستیم.'),
  ('instagram', 'https://instagram.com/azadcoffee'),
  ('phone', '054-XXXXXXXX');

-- Menu Config (maps categories to bot menu sections)
INSERT INTO menu_config (category_id, menu_section, display_order, is_visible, created_at, updated_at) VALUES
  (1,  'drinks', 1, 1, unixepoch(), unixepoch()),
  (4,  'drinks', 2, 1, unixepoch(), unixepoch()),
  (5,  'drinks', 3, 1, unixepoch(), unixepoch()),
  (6,  'drinks', 4, 1, unixepoch(), unixepoch()),
  (7,  'drinks', 5, 1, unixepoch(), unixepoch()),
  (8,  'cakes',  1, 1, unixepoch(), unixepoch()),
  (9,  'beans',  1, 1, unixepoch(), unixepoch()),
  (10, 'extras', 1, 0, unixepoch(), unixepoch());

-- Preserve pour-over special message for category 7
UPDATE menu_config
SET special_message = '☕ <b>قهوه‌های دمی تخصصی</b>

برای اطلاع از قهوه‌های دمی تخصصی امروز از باریستا سوال کنید.

<i>تمامی قیمت‌ها شامل ۱۰٪ مالیات بر ارزش افزوده می‌باشند.</i>'
WHERE category_id = 7;
