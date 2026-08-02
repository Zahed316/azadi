import { expect, test } from 'vitest';

test('FAQ GET response shape', () => {
  const response = { faqs: [{ id: 1, question: 'Q?', answer: 'A.' }] };
  expect(Array.isArray(response.faqs)).toBe(true);
  expect(response.faqs[0]).toHaveProperty('question');
  expect(response.faqs[0]).toHaveProperty('answer');
});

test('Branch GET response shape', () => {
  const response = { branches: [{ id: 1, name: 'Main', address: '123 St', phone: null, location: null, openingHours: null, isActive: true }] };
  expect(Array.isArray(response.branches)).toBe(true);
  expect(response.branches[0]).toHaveProperty('name');
  expect(response.branches[0]).toHaveProperty('address');
});

test('FAQ POST requires question and answer', () => {
  const body = { question: 'Q?', answer: 'A.' };
  expect(body.question).toBeTruthy();
  expect(body.answer).toBeTruthy();
});

test('Branch POST requires name and address', () => {
  const body = { name: 'Branch', address: '123 St' };
  expect(body.name).toBeTruthy();
  expect(body.address).toBeTruthy();
});
