// Score an item against query keywords
function score(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter(k => lower.includes(k)).length;
}

export function buildMinimalContext(query: string, productsWithDetails: any[], branches: any[], faqs: any[]): string {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  let ctx = "=== BRANCHES ===\n";
  for (const b of branches) {
    ctx += `- ${b.name}: ${b.address} | Phone: ${b.phone || 'N/A'} | Hours: ${b.openingHours || 'N/A'}\n`;
  }

  // Top 5 scored products
  const scoredProducts = productsWithDetails
    .map(row => ({ row, s: score(`${row.products.name} ${row.products.description}`, keywords) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);

  ctx += "\n=== PRODUCTS (top matches) ===\n";
  for (const { row } of scoredProducts) {
    const p = row.products;
    const d = row.coffee_details;
    let detailsStr = '';
    if (d) {
      detailsStr = ` [Origin: ${d.origin || ''}, Roast: ${d.roastLevel || ''}, Notes: ${d.flavorNotes || ''}]`;
    }
    ctx += `- ${p.name} (Cat: ${p.categoryId}): ${p.price} Tomans | ${p.description || ''}${detailsStr} | Stock: ${p.stock}\n`;
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
