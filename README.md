# Azadi Coffee Roastery

Telegram bot + admin Web App for Azadi Coffee Roastery in Iranshahr, Iran.

## Deployed

| Unit | URL | Platform |
|------|-----|----------|
| Menu Website | [www.azadiroastery.ir](https://www.azadiroastery.ir) | Cloudflare Pages |
| Admin Mini App | [azadi-admin.pages.dev](https://azadi-admin.pages.dev) | Cloudflare Pages |
| Bot + API | [azadi-coffee-bot.zahedrastgar316.workers.dev](https://azadi-coffee-bot.zahedrastgar316.workers.dev) | Cloudflare Workers |

## Tech Stack

- **Backend:** Cloudflare Workers, grammY bot framework, D1 database (Drizzle ORM)
- **Frontend:** React 18, Vite 6, TanStack Query v5, `@telegram-apps/sdk` v2
- **AI:** OpenCode API (`mimo-v2.5` model)
- **CI/CD:** GitHub Actions → Cloudflare Workers + Pages

## Quick Start

```bash
# Worker (root)
npm ci
npm run check                        # typecheck + lint + format + test

# Admin Mini App
cd admin-app && npm ci && npm run check

# Menu Website
cd menu-app && npm ci && npm run check
```

## Architecture

See [CLAUDE.md](CLAUDE.md) for full architecture, commands, conventions, and pitfalls.

**Three deployable units:**
1. `src/` — Worker (bot webhook + REST API + public API)
2. `admin-app/` — Admin Mini App (React + Vite)
3. `menu-app/` — Public menu website (React + Vite)

## License

Private — Azadi Coffee Roastery.
