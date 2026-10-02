import test from 'node:test';
import assert from 'node:assert/strict';
import Category from '../models/Category.js';
import { getCategories } from '../controllers/categoryReadController.js';

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('public category list returns Sub Categories and legacy data, never Child Categories', async () => {
  const originalFind = Category.find;
  const parent = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Men',
    level: 'parent',
    isActive: true,
  };
  const categories = [
    {
      _id: '507f1f77bcf86cd799439012',
      name: 'Summer Clothes',
      level: 'sub',
      parentCategory: parent,
    },
    {
      _id: '507f1f77bcf86cd799439013',
      name: 'Inactive Parent Sub',
      level: 'sub',
      parentCategory: { ...parent, isActive: false },
    },
    { _id: 'legacy-id', name: 'Legacy Category', level: 'legacy' },
    { _id: 'child-id', name: 'T-Shirts', level: 'child' },
  ];
  const response = createResponse();
  let filter;

  Category.find = (query) => {
    filter = query;
    return {
      populate() {
        return this;
      },
      async sort() {
        return categories;
      },
    };
  };

  try {
    await getCategories({}, response, (error) => {
      throw error;
    });
  } finally {
    Category.find = originalFind;
  }

  assert.deepEqual(filter.$or, [
    { level: { $in: ['sub', 'legacy'] } },
    { level: { $exists: false } },
  ]);
  assert.deepEqual(
    response.body.data.map((category) => category._id),
    ['507f1f77bcf86cd799439012', 'legacy-id'],
  );
});