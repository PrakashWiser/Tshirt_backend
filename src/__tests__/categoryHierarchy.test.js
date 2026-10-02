import test from 'node:test';
import assert from 'node:assert/strict';
import Category from '../models/Category.js';
import { getProductCategoryError } from '../utils/categoryHierarchy.js';

const categoryId = '507f1f77bcf86cd799439011';

test('product assignment accepts only active Sub Categories with active Parents', async () => {
  const originalFindById = Category.findById;
  const parent = { level: 'parent', isActive: true };
  let selectedCategory = {
    level: 'sub',
    isActive: true,
    parentCategory: parent,
  };
  Category.findById = () => ({
    populate: async () => selectedCategory,
  });

  try {
    assert.equal(await getProductCategoryError(categoryId), null);

    selectedCategory = {
      level: 'child',
      isActive: true,
      parentCategory: { level: 'sub', isActive: true },
    };
    assert.match(await getProductCategoryError(categoryId), /subcategory/i);

    selectedCategory = {
      level: 'sub',
      isActive: true,
      parentCategory: { level: 'parent', isActive: false },
    };
    assert.match(await getProductCategoryError(categoryId), /parent category/i);
  } finally {
    Category.findById = originalFindById;
  }
});

test('legacy product assignments are allowed only when unchanged', async () => {
  const originalFindById = Category.findById;
  Category.findById = () => ({
    populate: async () => ({ level: 'legacy', isActive: true }),
  });

  try {
    assert.match(await getProductCategoryError(categoryId), /subcategory/i);
    assert.equal(
      await getProductCategoryError(categoryId, { allowExistingLegacy: true }),
      null,
    );
  } finally {
    Category.findById = originalFindById;
  }
});
