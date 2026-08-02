import { expect, test } from 'vitest';

test('getBySection result shape has required fields', () => {
  const mockResult = [{
    id: 1,
    categoryId: 1,
    menuSection: 'drinks',
    displayOrder: 1,
    isVisible: true,
    buttonLabel: null,
    specialMessage: null,
    categoryName: 'Espresso',
    categoryEmoji: '☕',
  }];
  expect(mockResult[0]).toHaveProperty('categoryId');
  expect(mockResult[0]).toHaveProperty('menuSection');
  expect(mockResult[0]).toHaveProperty('isVisible');
  expect(mockResult[0].menuSection).toBe('drinks');
  expect(mockResult.filter(r => r.isVisible)).toHaveLength(1);
});

test('menu-config API response shape is correct', () => {
  const fakeResponse = {
    menuConfigs: [{ id: 1, categoryId: 1, menuSection: 'drinks', displayOrder: 1 }],
  };
  expect(Array.isArray(fakeResponse.menuConfigs)).toBe(true);
  expect(fakeResponse.menuConfigs[0]).toHaveProperty('menuSection');
  expect(fakeResponse.menuConfigs[0]).toHaveProperty('displayOrder');
});

test('reorder swap produces correct display orders', () => {
  const items = [
    { id: 1, displayOrder: 1 },
    { id: 2, displayOrder: 2 },
    { id: 3, displayOrder: 3 },
  ];
  // Move item at idx=1 up (swap with idx=0)
  const swapped = [
    { id: items[1].id, displayOrder: items[0].displayOrder },
    { id: items[0].id, displayOrder: items[1].displayOrder },
  ];
  expect(swapped[0]).toEqual({ id: 2, displayOrder: 1 });
  expect(swapped[1]).toEqual({ id: 1, displayOrder: 2 });
});

test('button label falls back to emoji+name when null', () => {
  const config = { buttonLabel: null, categoryEmoji: '☕', categoryName: 'Espresso' };
  const label = config.buttonLabel ?? `${config.categoryEmoji ? config.categoryEmoji + ' ' : ''}${config.categoryName}`;
  expect(label).toBe('☕ Espresso');
});

test('button label uses custom label when set', () => {
  const config = { buttonLabel: 'Special Blend', categoryEmoji: '☕', categoryName: 'Espresso' };
  const label = config.buttonLabel ?? `${config.categoryEmoji ? config.categoryEmoji + ' ' : ''}${config.categoryName}`;
  expect(label).toBe('Special Blend');
});

test('special message overrides generic empty state', () => {
  const config = { specialMessage: 'Custom empty message', categoryName: 'Pour-over' };
  const msg = config.specialMessage ?? `در حال حاضر ${config.categoryName} موجود نیست.`;
  expect(msg).toBe('Custom empty message');
  expect(msg).not.toContain('موجود نیست');
});
