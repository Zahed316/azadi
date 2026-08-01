# Memory

## Project Overview
See @README.md for project overview and @package.json for available npm/pnpm commands for this project.

## Code Style Guidelines
- Use descriptive variable names
- Follow existing patterns in the codebase
- Extract complex conditions into meaningful boolean variables

## Architecture Notes
Add important architectural decisions and patterns here.

- **grammY Conversations Persistence**: When using `@grammyjs/conversations` (v2.x) in a serverless environment (Cloudflare Workers), NEVER initialize it with `bot.use(conversations())` as it defaults to an in-memory map that wipes between requests. You MUST explicitly configure it to use persistent storage (e.g., `D1SessionStorage`) and provide a unique prefix (`prefix: "convo_"`) to prevent overwriting the main session data.
- **Conversations & AI Race Conditions**: When using `@grammyjs/conversations` alongside a slow fallback handler (like an AI service), Telegram webhook retries can cause race conditions. If the final step of a conversation (e.g., database update) takes too long, Telegram will retry the webhook. Because `session` data is only saved at the *end* of the request, session-based idempotency (`lastUpdateId`) fails for concurrent retries. The retry will find an empty conversation state and fall through to the AI handler. 
  - **Definitive Solution applied to this codebase**: We completely removed admin conversational wizards from the chat interface. Admin multi-step data entry is now handled via a standalone Telegram Mini App (Web App) connecting to REST endpoints on the Cloudflare Worker, entirely isolating it from the webhook AI loop.

## Common Workflows
Document frequently used workflows and commands here.
