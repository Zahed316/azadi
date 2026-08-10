# Luxury Premium Redesign — Azadi Cafe Digital Menu

**Date:** 2026-08-10
**Scope:** `menu-app/` only (React SPA on Cloudflare Pages)
**Status:** Approved

## Direction

### Palette — Hybrid (dark + light editorial)
- **Dark sections:** espresso `#171310` — hero, footer
- **Light body:** warm cream `#f6f1ea` — all content below the hero
- **Text:** ink `#221c17` (primary), muted `#7a7067` (secondary)
- **Accent:** brass `#c9a26b` — used sparingly (links, rules, eyebrows)
- **Hairlines:** `rgba(34,28,23,.14)` on light, `rgba(246,241,234,.16)` on dark

### Typography — Self-hosted woff2, no runtime CDN
| Role | Family | Weight | Source |
|------|--------|--------|--------|
| Display/headlines (Persian) | Estedad | 700, 800 | `aminabedi68/Estedad` v8.5 zip, OFL |
| Body/UI (Persian) | Vazirmatn | 400, 500, 700 | `@fontsource/vazirmatn` 5.3.0 |
| Latin wordmarks/accents | Fraunces | 600 (latin subset) | `@fontsource/fraunces` 5.3.0 |

Budget: ≤ 250KB total fonts.

### Imagery — Typographic-first
- Products without photos: monogram tile (first letter of name + category-tinted background)
- Real photos slot into the same layout when admins add them
- Broken images fall back via `<img onError>` → monogram
- No dependency on photography that doesn't exist yet

### Design language
- Hairline rules instead of card boxes
- Numbered category index (۰۱ ۰۲ ۰۳) with Persian numerals
- Tasting-menu product rows with dot leaders between name and price
- Latin small-caps eyebrows (`dir="ltr"`) for brand accents
- Micro-label badges (not pill shapes)
- CSS-only reveal motion + `prefers-reduced-motion` support

## Technical path
- CSS/design-token rewrite + component-level restructure inside existing React 18 + Vite 6 + HashRouter + TanStack Query stack
- No framework change, no router change, no SSR
- No Worker/D1/KV/admin/bot changes — public API consumed as-is
- All adaptation is menu-app-internal type corrections and UI restyling

## Bug fixes included
1. ProductPage interface mismatch (isFeatured → featured, flat coffee_details → nested)
2. BranchesPage interface mismatch (hours → openingHours)
3. Broken image URLs (onError fallback to monogram)
4. Price unit fix ("۸۵ cup" → "۸۵ تومان" via settings.price_unit)

## Font licensing
- Estedad: SIL Open Font License (verify LICENSE inside zip before committing)
- Vazirmatn: OFL (via fontsource)
- Fraunces: OFL (via fontsource)
