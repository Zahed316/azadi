-- CHECK constraints for data integrity (DB-002).
-- SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we use triggers.
-- Validated against production: zero violations before application.

-- Products: stock must be non-negative
CREATE TRIGGER IF NOT EXISTS chk_products_stock_non_negative
  AFTER INSERT ON products
  WHEN NEW.stock < 0
BEGIN
  SELECT RAISE(ABORT, 'stock must be >= 0');
END;

CREATE TRIGGER IF NOT EXISTS chk_products_stock_non_negative_update
  AFTER UPDATE ON products
  WHEN NEW.stock < 0
BEGIN
  SELECT RAISE(ABORT, 'stock must be >= 0');
END;

-- Products: price must be non-negative (or null)
CREATE TRIGGER IF NOT EXISTS chk_products_price_non_negative
  AFTER INSERT ON products
  WHEN NEW.price IS NOT NULL AND NEW.price < 0
BEGIN
  SELECT RAISE(ABORT, 'price must be >= 0');
END;

CREATE TRIGGER IF NOT EXISTS chk_products_price_non_negative_update
  AFTER UPDATE ON products
  WHEN NEW.price IS NOT NULL AND NEW.price < 0
BEGIN
  SELECT RAISE(ABORT, 'price must be >= 0');
END;

-- Products: unit must be valid
CREATE TRIGGER IF NOT EXISTS chk_products_unit_valid
  AFTER INSERT ON products
  WHEN NEW.unit NOT IN ('cup', 'kg', 'piece', 'slice', 'item')
BEGIN
  SELECT RAISE(ABORT, 'unit must be one of: cup, kg, piece, slice, item');
END;

CREATE TRIGGER IF NOT EXISTS chk_products_unit_valid_update
  AFTER UPDATE ON products
  WHEN NEW.unit NOT IN ('cup', 'kg', 'piece', 'slice', 'item')
BEGIN
  SELECT RAISE(ABORT, 'unit must be one of: cup, kg, piece, slice, item');
END;

-- Menu config: menu_section must be valid
CREATE TRIGGER IF NOT EXISTS chk_menu_section_valid
  AFTER INSERT ON menu_config
  WHEN NEW.menu_section NOT IN ('drinks', 'beans', 'cakes', 'extras')
BEGIN
  SELECT RAISE(ABORT, 'menu_section must be one of: drinks, beans, cakes, extras');
END;

CREATE TRIGGER IF NOT EXISTS chk_menu_section_valid_update
  AFTER UPDATE ON menu_config
  WHEN NEW.menu_section NOT IN ('drinks', 'beans', 'cakes', 'extras')
BEGIN
  SELECT RAISE(ABORT, 'menu_section must be one of: drinks, beans, cakes, extras');
END;

-- Admins: role must be valid
CREATE TRIGGER IF NOT EXISTS chk_admin_role_valid
  AFTER INSERT ON admins
  WHEN NEW.role NOT IN ('super_admin', 'category_admin')
BEGIN
  SELECT RAISE(ABORT, 'role must be one of: super_admin, category_admin');
END;

CREATE TRIGGER IF NOT EXISTS chk_admin_role_valid_update
  AFTER UPDATE ON admins
  WHEN NEW.role NOT IN ('super_admin', 'category_admin')
BEGIN
  SELECT RAISE(ABORT, 'role must be one of: super_admin, category_admin');
END;

-- Messages: rating must be 1-5 or null
CREATE TRIGGER IF NOT EXISTS chk_messages_rating_range
  AFTER INSERT ON messages
  WHEN NEW.rating IS NOT NULL AND (NEW.rating < 1 OR NEW.rating > 5)
BEGIN
  SELECT RAISE(ABORT, 'rating must be between 1 and 5');
END;

CREATE TRIGGER IF NOT EXISTS chk_messages_rating_range_update
  AFTER UPDATE ON messages
  WHEN NEW.rating IS NOT NULL AND (NEW.rating < 1 OR NEW.rating > 5)
BEGIN
  SELECT RAISE(ABORT, 'rating must be between 1 and 5');
END;
