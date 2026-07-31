export function formatProduct(p: any): string {
  let text = `📦 <b>${p.name}</b>\n`;
  if (p.description) text += `\n${p.description}\n`;
  if (p.priceOnRequest) {
    text += `\n💰 Price: Ask in store`;
  } else {
    text += `\n💰 Price: ${p.price} Tomans`;
  }
  if (p.isSeasonal) text += `\n🌿 <i>Seasonal item</i>`;
  if (p.sizeOptions) text += `\n📐 Sizes: ${JSON.parse(p.sizeOptions).join(', ')}`;
  if (p.syrupOptions) text += `\n🍯 Syrups: ${JSON.parse(p.syrupOptions).join(', ')}`;
  // Only show stock for physical goods (beans, equipment)
  if (p.unit !== 'cup') {
    text += `\n📦 Stock: ${p.stock > 0 ? `${p.stock} ${p.unit}` : 'Out of stock'}`;
  }
  text += `\n\n<i>All prices include 10% VAT.</i>`;
  return text;
}

export function formatBranch(b: any): string {
  let text = `📍 <b>${b.name}</b>\n`;
  text += `\n🏢 Address: ${b.address}`;
  if (b.phone) text += `\n📞 Phone: ${b.phone}`;
  if (b.openingHours) text += `\n⏰ Hours: ${b.openingHours}`;
  return text;
}

export function formatFaq(f: any): string {
  return `❓ <b>${f.question}</b>\n\n💬 ${f.answer}`;
}
