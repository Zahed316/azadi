/**
 * Streak middleware env-var cache test.
 *
 * Verifies that the streak middleware checks STREAK_MESSAGES env var first
 * (avoiding a D1 round-trip) and only falls back to D1 when the env var
 * is absent.
 */
import { describe, expect, test, vi, beforeEach } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';

// ── Mock repositories (only the ones used by the streak middleware) ─────────

const { mockGetValue, MockSettingsRepository } = vi.hoisted(() => {
  const mockGetValue = vi.fn().mockResolvedValue(null);
  // Use a function expression (not arrow) so it works as a constructor with `new`.
  const MockSettingsRepository = vi.fn(function () {
    return { getValue: mockGetValue };
  });
  return { mockGetValue, MockSettingsRepository };
});

vi.mock('../repositories', () => ({
  SettingsRepository: MockSettingsRepository,
  UserStateRepository: class {
    upsertVisit = vi.fn().mockResolvedValue({
      streakDays: 3,
      isNewStreak: true,
      isFirstVisit: false,
    });
  },
}));

// ── Mock downstream handlers to prevent AI/API calls ───────────────────────

vi.mock('../handlers/message', () => ({
  setupMessageHandlers: vi.fn(),
}));

vi.mock('../handlers/callbackQuery', () => ({
  setupCallbackHandlers: vi.fn(),
}));

vi.mock('../commands/admin', () => ({
  setupAdminCommands: vi.fn(),
}));

vi.mock('../menus/mainMenu', () => ({
  mainMenu: Object.assign(
    (_ctx: any, next: any) => next?.(),
    { register: vi.fn() },
  ),
  getWelcomeText: vi.fn().mockResolvedValue('welcome'),
}));

vi.mock('../menus/discoverMenu', () => ({ discoverMenu: {} }));
vi.mock('../menus/infoMenu', () => ({ infoMenu: {} }));
vi.mock('../menus/productsMenu', () => ({ beansMenu: {}, cakesMenu: {} }));
vi.mock('../menus/drinksNavMenu', () => ({ drinksNavMenu: {} }));

vi.mock('../services/data', () => ({
  DataService: class {
    constructor(_db: any, _cache?: any) {}
  },
}));

vi.mock('../services/cache', () => ({
  CacheService: class {
    constructor(_kv?: any) {}
  },
}));

vi.mock('../database/sessionStorage', () => ({
  D1SessionStorage: class {
    async read() {
      return undefined;
    }
    async write() {}
    async delete() {}
  },
}));

vi.mock('../database/conditionalSessionStorage', () => ({
  ConditionalSessionStorage: class {
    async read() {
      return undefined;
    }
    async write() {}
    async delete() {}
  },
}));

vi.mock('../utils/menuLifecycle', () => ({
  pushMessage: vi.fn().mockReturnValue(undefined),
}));

// ── Mock requestContext (controls which env the bot sees) ───────────────────

const mockGetEnv = vi.fn().mockReturnValue(undefined);

vi.mock('../requestContext', () => ({
  getEnv: (...args: any[]) => mockGetEnv(...args),
  getExecCtx: vi.fn().mockReturnValue(undefined),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { createBot, type Env } from '../bot';

const BOT_INFO = {
  id: 1,
  is_bot: true,
  first_name: 'Test',
  username: 'test_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
};

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    TELEGRAM_BOT_TOKEN: 'test-token',
    SECRET_TOKEN: 'test-secret',
    DB: {} as D1Database,
    OPENCODE_API_KEY: 'test-api-key',
    ...overrides,
  };
}

function makeUpdate(userId = 123) {
  return {
    update_id: Date.now(),
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: userId, type: 'private' as const },
      from: { id: userId, is_bot: false, first_name: 'Test' },
      text: 'hello',
    },
  };
}

describe('streak middleware env-var cache', () => {
  const bot = createBot(makeEnv());
  bot.botInfo = BOT_INFO;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetValue.mockResolvedValue(null);
  });

  test('env STREAK_MESSAGES=true skips D1 read (no SettingsRepository instantiation)', async () => {
    mockGetEnv.mockReturnValue(makeEnv({ STREAK_MESSAGES: 'true' }));

    await bot.handleUpdate(makeUpdate());

    expect(MockSettingsRepository).not.toHaveBeenCalled();
  });

  test('env STREAK_MESSAGES undefined falls back to D1 read (SettingsRepository instantiated)', async () => {
    mockGetEnv.mockReturnValue(makeEnv({ STREAK_MESSAGES: undefined }));

    await bot.handleUpdate(makeUpdate());

    expect(MockSettingsRepository).toHaveBeenCalled();
  });
});
