// Score pre-normalized searchable text against normalized query keywords.
function score(normalizedText: string, keywords: string[]): number {
  return keywords.filter((k) => normalizedText.includes(k)).length;
}

export interface MenuContextOptions {
  query: string;
  productsWithDetails: any[];
  branches: any[];
  faqs: any[];
  visibleCategoryIds?: Set<number>;
  settings?: Record<string, string>;
  popularProducts?: Array<{ name: string; category: string; favoritedCount: number }>;
  productCap?: number;
  faqCap?: number;
}

export function buildMinimalContext(
  queryOrOptions: string | MenuContextOptions,
  productsWithDetails?: any[],
  branches?: any[],
  faqs?: any[],
  visibleCategoryIds?: Set<number>,
): string {
  // Support both legacy positional args and new options object
  const opts: MenuContextOptions =
    typeof queryOrOptions === 'string'
      ? {
          query: queryOrOptions,
          productsWithDetails: productsWithDetails ?? [],
          branches: branches ?? [],
          faqs: faqs ?? [],
          visibleCategoryIds,
        }
      : queryOrOptions;

  const {
    query,
    productsWithDetails: allProducts,
    branches: allBranches,
    faqs: allFaqs,
    visibleCategoryIds: visIds,
    settings,
    popularProducts,
    productCap = 8,
    faqCap = 3,
  } = opts;

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Filter products to only those whose category is visible in the menu.
  // If visibleCategoryIds is not provided (e.g., in tests), include all.
  const eligibleProducts = visIds
    ? allProducts.filter((row) => visIds.has(row.products.categoryId))
    : allProducts;

  let ctx = '';

  // Shop identity from settings
  if (settings?.about) {
    ctx += `=== ABOUT AZADI COFFEE ROASTERY ===\n${settings.about}\n\n`;
  }

  // Branches
  ctx += '=== BRANCHES ===\n';
  for (const b of allBranches) {
    const loc = b.location ? ` | Maps: ${b.location}` : '';
    ctx += `- ${b.name}: ${b.address} | Phone: ${b.phone || 'N/A'} | Hours: ${b.openingHours || 'N/A'}${loc}\n`;
  }

  // Scored products with enriched details
  const scoredProducts = eligibleProducts
    .map((row) => {
      const searchable = [
        row.products.name,
        row.products.description || '',
        row.coffee_details?.origin || '',
        row.coffee_details?.farm || '',
        row.coffee_details?.flavorNotes || '',
        row.categories?.name || '',
      ]
        .join(' ')
        .toLowerCase();
      return { row, s: score(searchable, keywords) };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, productCap);

  ctx += `\n=== PRODUCTS (top ${productCap} from active menu) ===\n`;
  for (const { row } of scoredProducts) {
    const p = row.products;
    const d = row.coffee_details;
    const catName = row.categories?.name ?? `Cat#${p.categoryId}`;

    // Flags
    const flags: string[] = [];
    if (p.featured) flags.push('⭐ Featured');
    if (p.isSeasonal) flags.push('🌿 Seasonal');
    const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';

    // Coffee details (extended)
    let coffeeStr = '';
    if (d) {
      const parts: string[] = [];
      if (d.origin) parts.push(`Origin: ${d.origin}`);
      if (d.farm) parts.push(`Farm: ${d.farm}`);
      if (d.altitude) parts.push(`Altitude: ${d.altitude}`);
      if (d.processing) parts.push(`Process: ${d.processing}`);
      if (d.variety) parts.push(`Variety: ${d.variety}`);
      if (d.roastLevel) parts.push(`Roast: ${d.roastLevel}`);
      if (d.flavorNotes) parts.push(`Notes: ${d.flavorNotes}`);
      if (d.acidity) parts.push(`Acidity: ${d.acidity}`);
      if (d.body) parts.push(`Body: ${d.body}`);
      if (d.brewGuide) parts.push(`Brew: ${d.brewGuide}`);
      if (parts.length) coffeeStr = ` [${parts.join(', ')}]`;
    }

    // Nutritional info
    let nutritionStr = '';
    const nutrition: string[] = [];
    if (p.calories != null) nutrition.push(`Cal: ${p.calories}`);
    if (p.caffeineMg != null) nutrition.push(`Caffeine: ${p.caffeineMg}mg`);
    if (p.allergens) nutrition.push(`Allergens: ${p.allergens}`);
    if (nutrition.length) nutritionStr = ` {${nutrition.join(', ')}}`;

    // Price (show unit for non-cup items)
    const priceStr =
      p.price != null
        ? p.unit === 'cup'
          ? `${p.price} Tomans/cup`
          : p.priceOnRequest
            ? 'Price on request'
            : `${p.price} Tomans/${p.unit || 'item'}`
        : 'Price TBD';

    ctx += `- ${p.name} (${catName}): ${priceStr}${flagStr}${coffeeStr}${nutritionStr} | Stock: ${p.stock}\n`;
  }

  // Popular products (most favorited across all users)
  if (popularProducts && popularProducts.length > 0) {
    ctx += '\n=== POPULAR ITEMS (most favorited by customers) ===\n';
    for (const pop of popularProducts.slice(0, 5)) {
      ctx += `- ${pop.name} (${pop.category}) — ${pop.favoritedCount} favorites\n`;
    }
  }

  // FAQs
  const scoredFaqs = allFaqs
    .map((f) => ({ f, s: score(`${f.question} ${f.answer}`.toLowerCase(), keywords) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, faqCap);

  ctx += '\n=== FAQ ===\n';
  for (const { f } of scoredFaqs) {
    ctx += `- Q: ${f.question}\n  A: ${f.answer}\n`;
  }

  return ctx;
}
