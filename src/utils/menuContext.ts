// Score an item against query keywords
function score(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter(k => lower.includes(k)).length;
}

export function buildMinimalContext(
  query: string,
  productsWithDetails: any[],
  branches: any[],
  faqs: any[],
  visibleCategoryIds?: Set<number>
): string {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  // Filter products to only those whose category is visible in the menu.
  // If visibleCategoryIds is not provided (e.g., in tests), include all.
  const eligibleProducts = visibleCategoryIds
    ? productsWithDetails.filter(row => visibleCategoryIds.has(row.products.categoryId))
    : productsWithDetails;

  let ctx = "=== BRANCHES ===\n";
  for (const b of branches) {
    ctx += `- ${b.name}: ${b.address} | Phone: ${b.phone || 'N/A'} | Hours: ${b.openingHours || 'N/A'}\n`;
  }

  // Top 5 scored products (from visible categories only)
  const scoredProducts = eligibleProducts
    .map(row => ({ row, s: score(`${row.products.name} ${row.products.description}`, keywords) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);

  ctx += "\n=== PRODUCTS (top matches from active menu) ===\n";
  for (const { row } of scoredProducts) {
    const p = row.products;
    const d = row.coffee_details;
    // Use human-readable category name from the joined categories table
    const catName = row.categories?.name ?? `Cat#${p.categoryId}`;
    let detailsStr = '';
    if (d) {
      detailsStr = ` [Origin: ${d.origin || ''}, Roast: ${d.roastLevel || ''}, Notes: ${d.flavorNotes || ''}]`;
    }
    ctx += `- ${p.name} (${catName}): ${p.price} Tomans | ${p.description || ''}${detailsStr} | Stock: ${p.stock}\n`;
  }

  // Top 3 scored FAQs
  const scoredFaqs = faqs
    .map(f => ({ f, s: score(`${f.question} ${f.answer}`, keywords) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);

  ctx += "\n=== FAQ ===\n";
  for (const { f } of scoredFaqs) {
    ctx += `- Q: ${f.question}\n  A: ${f.answer}\n`;
  }

  return ctx;
}
