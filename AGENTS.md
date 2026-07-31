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

## Common Workflows
Document frequently used workflows and commands here.
