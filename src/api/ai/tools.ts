// ---------------------------------------------------------------------------
// AI Admin Assistant — tool definitions for the OpenCode API
//
// These map 1:1 to D1/KV operations. The executor (Task 6) will implement
// each tool; the chat handler (Task 7) sends this array to the model so it
// knows what it can call.
// ---------------------------------------------------------------------------

import type { AiTool } from './types';

export const AI_TOOLS: AiTool[] = [
  // -- Products ---------------------------------------------------------------
  {
    name: 'createProduct',
    description: 'Create a new product in the database',
    parameters: {
      name: { type: 'string', required: true },
      categoryId: { type: 'number', required: true },
      price: { type: 'number' },
      stock: { type: 'number', default: 0 },
      unit: {
        type: 'string',
        enum: ['item', 'cup', 'kg', 'g', 'slice', 'piece'],
      },
      description: { type: 'string' },
      available: { type: 'boolean', default: true },
      featured: { type: 'boolean', default: false },
      isSeasonal: { type: 'boolean', default: false },
      priceOnRequest: { type: 'boolean', default: false },
      imageUrl: { type: 'string' },
    },
  },
  {
    name: 'updateProduct',
    description: 'Update an existing product',
    parameters: {
      id: { type: 'number', required: true },
      name: { type: 'string' },
      categoryId: { type: 'number' },
      price: { type: 'number' },
      stock: { type: 'number' },
      unit: {
        type: 'string',
        enum: ['item', 'cup', 'kg', 'g', 'slice', 'piece'],
      },
      description: { type: 'string' },
      available: { type: 'boolean' },
      featured: { type: 'boolean' },
      isSeasonal: { type: 'boolean' },
      priceOnRequest: { type: 'boolean' },
      imageUrl: { type: 'string' },
    },
  },
  {
    name: 'deleteProduct',
    description: 'Delete a product by ID',
    parameters: {
      id: { type: 'number', required: true },
    },
  },
  {
    name: 'batchUpdateProducts',
    description: 'Update or delete multiple products at once',
    parameters: {
      ids: { type: 'number[]', required: true },
      action: { type: 'string', enum: ['update', 'delete'], required: true },
      updateData: { type: 'object' },
    },
  },

  // -- Categories -------------------------------------------------------------
  {
    name: 'createCategory',
    description: 'Create a new category',
    parameters: {
      name: { type: 'string', required: true },
      emoji: { type: 'string' },
      description: { type: 'string' },
      sortOrder: { type: 'number' },
    },
  },
  {
    name: 'updateCategory',
    description: 'Update an existing category',
    parameters: {
      id: { type: 'number', required: true },
      name: { type: 'string' },
      emoji: { type: 'string' },
      description: { type: 'string' },
      sortOrder: { type: 'number' },
    },
  },
  {
    name: 'deleteCategory',
    description: 'Delete a category by ID',
    parameters: {
      id: { type: 'number', required: true },
    },
  },
  {
    name: 'reorderCategories',
    description: 'Reorder categories by providing the new ID sequence',
    parameters: {
      orderedIds: { type: 'number[]', required: true },
    },
  },

  // -- Settings ---------------------------------------------------------------
  {
    name: 'updateSetting',
    description: 'Update a setting value (upsert by key)',
    parameters: {
      key: { type: 'string', required: true },
      value: { type: 'string', required: true },
    },
  },
  {
    name: 'getSettings',
    description: 'Get current settings (all or by key list)',
    parameters: {
      keys: { type: 'string[]' },
    },
  },

  // -- Menu config ------------------------------------------------------------
  {
    name: 'updateMenuConfig',
    description: 'Update menu configuration for a category (upsert by categoryId)',
    parameters: {
      categoryId: { type: 'number', required: true },
      menuSection: { type: 'string' },
      displayOrder: { type: 'number' },
      isVisible: { type: 'boolean' },
      buttonLabel: { type: 'string' },
      specialMessage: { type: 'string' },
    },
  },

  // -- Cache ------------------------------------------------------------------
  {
    name: 'invalidateCache',
    description: 'Invalidate KV cache for specific resource prefixes',
    parameters: {
      prefix: {
        type: 'string',
        enum: ['products', 'categories', 'settings', 'menu-config', 'all'],
        required: true,
      },
    },
  },
];
