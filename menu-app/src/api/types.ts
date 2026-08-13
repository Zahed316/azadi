/** Shared interfaces matching the verified live public API shapes. */

export interface CoffeeDetails {
  productId?: number;
  origin?: string | null;
  farm?: string | null;
  altitude?: string | null;
  processing?: string | null;
  variety?: string | null;
  roastLevel?: string | null;
  flavorNotes?: string | null;
  recommendedBrew?: string | null;
  acidity?: string | null;
  body?: string | null;
  brewGuide?: string | null;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  unit: string;
  imageUrl?: string | null;
  description?: string;
  featured?: boolean;
  isSeasonal?: boolean;
  available?: boolean;
  priceOnRequest?: boolean;
  stock?: number;
  calories?: number | null;
  allergens?: string | null;
  caffeineMg?: number | null;
  coffee_details?: CoffeeDetails | null;
  category?: Category | null;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  emoji: string;
  sortOrder?: number;
}

export interface Branch {
  id: number;
  name: string;
  address: string;
  phone: string;
  openingHours: string;
  location?: string | null;
  isActive?: boolean;
}

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
}

export interface Settings {
  about?: string;
  price_unit?: string;
  instagram?: string;
  welcome_message?: string;
  vat_note?: string;
  announcement?: string;
}
