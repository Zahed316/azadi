#!/data/data/com.termux/files/usr/bin/env bash
# deploy.sh — Local preflight validation for Azadi Coffee Bot
#
# This script runs tests, typechecks, lint, and builds all three packages.
# It does NOT deploy — CI is the sole deploy path (push to main → GitHub Actions).
#
# Usage:
#   ./deploy.sh           # full preflight (test + typecheck + lint + build)
#   ./deploy.sh --skip-tests  # typecheck + lint + build, skip tests
#
# Prerequisites:
#   - Node.js 22+ installed
#   - npm dependencies installed (run `npm ci` first)
#   - admin-app dependencies installed (run `cd admin-app && npm ci`)
#   - menu-app dependencies installed (run `cd menu-app && npm ci`)

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

SKIP_TESTS=false

for arg in "$@"; do
  case $arg in
    --skip-tests) SKIP_TESTS=true ;;
    --help|-h)
      echo "Usage: $0 [--skip-tests]"
      echo "  --skip-tests  Typecheck + lint + build, skip tests"
      exit 0
      ;;
  esac
done

# ─── Preflight checks ────────────────────────────────────────────────
step "Preflight checks"

command -v node >/dev/null 2>&1 || fail "Node.js not found. Install Node.js 22+ first."
command -v npm  >/dev/null 2>&1 || fail "npm not found."

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_VERSION" -ge 22 ] || fail "Node.js 22+ required (found v$(node -v))"
ok "Node.js $(node -v)"

[ -d "node_modules" ] || fail "Root node_modules not found. Run 'npm ci' first."
ok "Root dependencies installed"

[ -d "admin-app/node_modules" ] || fail "admin-app/node_modules not found. Run 'cd admin-app && npm ci' first."
ok "Admin-app dependencies installed"

[ -d "menu-app/node_modules" ] || fail "menu-app/node_modules not found. Run 'cd menu-app && npm ci' first."
ok "Menu-app dependencies installed"

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

step "Typechecking Menu App"
cd menu-app
npm run typecheck 2>&1 | tail -3
ok "Menu-app typecheck passed"
cd ..

# ─── Step 3: Lint + Format ──────────────────────────────────────────
step "Linting"
npm run lint 2>&1 | tail -3
ok "Worker lint passed"

step "Formatting check"
npm run format:check 2>&1 | tail -3
ok "Worker format check passed"

# ─── Step 4: Build ───────────────────────────────────────────────────
step "Building Admin App"
cd admin-app
npm run build 2>&1 | tail -5
ok "Admin-app built → admin-app/dist/"
cd ..

step "Building Menu App"
cd menu-app
npm run build 2>&1 | tail -5
ok "Menu-app built → menu-app/dist/"
cd ..

# ─── Done ────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Preflight complete!${NC}"
echo -e "${GREEN}  All three packages: test ✓ typecheck ✓ lint ✓ format ✓ build ✓${NC}"
echo -e "${GREEN}  CI deploys on push to main.${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
