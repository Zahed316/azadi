import { SettingsRepository } from '../repositories';
import { D1Database } from '@cloudflare/workers-types';

const MENU_VISIBILITY_KEYS: Record<string, string> = {
  featured: 'menu_visible_featured',
  seasonal: 'menu_visible_seasonal',
  passport: 'menu_visible_passport',
  search: 'menu_visible_search',
  favorites: 'menu_visible_favorites',
  about: 'menu_visible_about',
  drinks: 'menu_visible_drinks',
  beans: 'menu_visible_beans',
  cakes: 'menu_visible_cakes',
  branches: 'menu_visible_branches',
  faq: 'menu_visible_faq',
};

export const HIDDEN_MESSAGE = '❌ این بخش در حال حاضر غیرفعال است.';

export async function isMenuVisible(env: { DB: D1Database }, section: string): Promise<boolean> {
  const key = MENU_VISIBILITY_KEYS[section];
  if (!key) return true;
  const value = await new SettingsRepository(env.DB).getValue(key);
  return value !== 'false';
}
