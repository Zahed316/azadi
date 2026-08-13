-- Phase 6a: Product nutritional info + coffee brew guide
ALTER TABLE products ADD calories integer;
ALTER TABLE products ADD allergens text;
ALTER TABLE products ADD caffeine_mg integer;
ALTER TABLE coffee_details ADD brew_guide text;
