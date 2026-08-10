export const queryKeys = {
  menu: ['menu'] as const,
  products: ['products'] as const,
  product: (id: number) => ['product', id] as const,
  featured: ['products', 'featured'] as const,
  seasonal: ['products', 'seasonal'] as const,
  categories: ['categories'] as const,
  branches: ['branches'] as const,
  faq: ['faq'] as const,
  settings: ['settings'] as const,
} as const;
