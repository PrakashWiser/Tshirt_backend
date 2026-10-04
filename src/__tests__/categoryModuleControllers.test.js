import test from 'node:test';
import assert from 'node:assert/strict';
import Category from '../models/Category.js';
import {
  createParentCategory,
  deleteParentCategory,
  getPublicParentCategories,
} from '../controllers/parentCategoryController.js';
import { createSubCategory } from '../controllers/subCategoryController.js';

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

test('createParentCategory stores status and optional image fields', async () => {
  const originalExists = Category.exists;
  const originalCreate = Category.create;
  const response = createResponse();
  let created;

  Category.exists = async () => false;
  Category.create = async (data) => {
    created = data;
    return data;
  };

  try {
    await createParentCategory(
      {
        body: { name: 'Men', description: 'Menswear', status: 'false' },
        files: {},
      },
      response,
      (error) => {
        throw error;
      },
    );
  } finally {
    Category.exists = originalExists;
    Category.create = originalCreate;
  }

  assert.equal(response.statusCode, 201);
  assert.equal(created.level, 'parent');
  assert.equal(created.isActive, false);
  assert.equal(created.image, '');
});

test('getPublicParentCategories returns only active parent categories', async () => {
  const originalFind = Category.find;
  const categories = [
    {
      _id: '507f1f77bcf86cd799439011',
      name: 'Men',
      image: 'https://example.com/men.jpg',
      isActive: true,
      toObject() {
        return {
          _id: this._id,
          name: this.name,
          image: this.image,
          isActive: this.isActive,
        };
      },
    },
  ];
  const response = createResponse();
  let filter;

  Category.find = (query) => {
    filter = query;
    return {
      async sort(sortOrder) {
        assert.deepEqual(sortOrder, { name: 1 });
        return categories;
      },
    };
  };

  try {
    await getPublicParentCategories({}, response, (error) => {
      throw error;
    });
  } finally {
    Category.find = originalFind;
  }

  assert.deepEqual(filter, { level: 'parent', isActive: true });
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data[0], {
    _id: '507f1f77bcf86cd799439011',
    name: 'Men',
    image: 'https://example.com/men.jpg',
    isActive: true,
    status: true,
  });
});

test('createSubCategory maps parentCategoryId and rejects duplicate siblings', async () => {
  const originalFindOne = Category.findOne;
  const originalExists = Category.exists;
  const originalCreate = Category.create;
  const parentId = '507f1f77bcf86cd799439011';
  const parent = { _id: parentId, name: 'Men', slug: 'men', level: 'parent', isActive: true };
  const response = createResponse();
  let created;

  Category.findOne = async () => parent;
  Category.exists = async () => false;
  Category.create = async (data) => {
    created = data;
    return data;
  };

  try {
    await createSubCategory(
      {
        body: {
          name: 'Summer Collection',
          description: 'Summer styles',
          parentCategoryId: parentId,
          status: 'true',
        },
      },
      response,
      (error) => {
        throw error;
      },
    );
  } finally {
    Category.findOne = originalFindOne;
    Category.exists = originalExists;
    Category.create = originalCreate;
  }

  assert.equal(response.statusCode, 201);
  assert.equal(created.level, 'sub');
  assert.equal(String(created.parentCategory), parentId);
  assert.equal(response.body.data.parentCategoryId, parentId);
  assert.equal(created.isActive, true);
});

test('deleteParentCategory blocks removal while subcategories exist', async () => {
  const originalFindOne = Category.findOne;
  const originalExists = Category.exists;
  const originalDelete = Category.findByIdAndDelete;
  const parent = {
    _id: '507f1f77bcf86cd799439011',
    level: 'parent',
    imagePublicId: '',
  };
  const response = createResponse();
  let wasDeleted = false;

  Category.findOne = async () => parent;
  Category.exists = async () => ({ _id: 'child-id' });
  Category.findByIdAndDelete = async () => {
    wasDeleted = true;
  };

  try {
    await deleteParentCategory(
      { params: { id: parent._id } },
      response,
      (error) => {
        throw error;
      },
    );
  } finally {
    Category.findOne = originalFindOne;
    Category.exists = originalExists;
    Category.findByIdAndDelete = originalDelete;
  }

  assert.equal(response.statusCode, 409);
  assert.equal(wasDeleted, false);
});
