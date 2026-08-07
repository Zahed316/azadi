#!/data/data/com.termux/files/usr/bin/env bash
# deploy.sh — Single-command production deploy for Azadi Coffee Bot
#
# Usage:
#   ./deploy.sh           # full deploy (test + build + deploy)
#   ./deploy.sh --dry-run # test + build only, no deploy
#   ./deploy.sh --skip-tests  # build + deploy, skip tests
#
# Prerequisites:
#   - Node.js 18+ installed
#   - npm dependencies installed (run `npm ci` first)
#   - CLOUDFLARE_API_TOKEN set in environment (for wrangler deploy)
#   - admin-app dependencies installed (run `cd admin-app && npm ci`)

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── Helpers ──────────────────────────────────────────────────────────
step() { echo -e "\n${BLUE}▸ $1${NC}"; }
ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; exit 1; }

DRY_RUN=false
SKIP_TESTS=false

for arg in "$@"; do
  case $arg in
    --dry-run)    DRY_RUN=true ;;
    --skip-tests) SKIP_TESTS=true ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--skip-tests]"
      echo "  --dry-run     Test + build only, no deploy"
      echo "  --skip-tests  Build + deploy, skip tests"
      exit 0
      ;;
  esac
done

# ─── Preflight checks ────────────────────────────────────────────────
step "Preflight checks"

command -v node >/dev/null 2>&1 || fail "Node.js not found. Install Node.js 18+ first."
command -v npm  >/dev/null 2>&1 || fail "npm not found."

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_VERSION" -ge 18 ] || fail "Node.js 18+ required (found v$(node -v))"
ok "Node.js $(node -v)"

[ -d "node_modules" ] || fail "Root node_modules not found. Run 'npm ci' first."
ok "Root dependencies installed"

[ -d "admin-app/node_modules" ] || fail "admin-app/node_modules not found. Run 'cd admin-app && npm ci' first."
ok "Admin-app dependencies installed"

if [ "$DRY_RUN" = false ]; then
  [ -n "${CLOUDFLARE_API_TOKEN:-}" ] || fail "CLOUDFLARE_API_TOKEN not set. Export it or run with --dry-run."
  ok "Cloudflare API token configured"
fi

# ─── Step 1: Tests ───────────────────────────────────────────────────
if [ "$SKIP_TESTS" = false ]; then
  step "Running unit tests"
  npm test 2>&1 | tail -5
  ok "All tests passed"
else
  warn "Skipping tests (--skip-tests)"
fi

# ─── Step 2: Typecheck ──────────────────────────────────────────────
step "Typechecking Worker (src/)"
npm run typecheck 2>&1 | tail -3
ok "Worker typecheck passed"

step "Typechecking Admin App"
cd admin-app
npm run typecheck 2>&1 | tail -3
ok "Admin-app typecheck passed"
cd ..

# ─── Step 3: Lint (non-blocking) ────────────────────────────────────
step "Linting (non-blocking)"
npm run lint 2>&1 | tail -3 || true
ok "Lint completed (warnings are non-blocking)"

# ─── Step 4: Build Admin App ─────────────────────────────────────────
step "Building Admin App"
cd admin-app
npm run build 2>&1 | tail -5
ok "Admin-app built → admin-app/dist/"
cd ..

# ─── Step 5: Deploy ─────────────────────────────────────────────────
if [ "$DRY_RUN" = true ]; then
  step "Dry run — skipping deploy"
  ok "Build complete. Ready for deployment."
  echo ""
  echo "To deploy manually:"
  echo "  npm run deploy                    # Worker"
  echo "  wrangler pages deploy admin-app/dist --project-name=azadi-admin  # Admin App"
  exit 0
fi

step "Deploying Worker"
npm run deploy 2>&1 | tail -5
ok "Worker deployed to azadi-coffee-bot"

step "Deploying Admin App to Cloudflare Pages"
npx wrangler pages deploy admin-app/dist --project-name=azadi-admin 2>&1 | tail -5
ok "Admin App deployed to azadi-admin.pages.dev"

# ─── Done ────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Deploy complete!${NC}"
echo -e "${GREEN}  Worker:    https://azadi-coffee-bot.zahedrastgar316.workers.dev${NC}"
echo -e "${GREEN}  Admin App: https://azadi-admin.pages.dev${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
