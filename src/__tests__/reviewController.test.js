import test from 'node:test';
import assert from 'node:assert/strict';
import Product from '../models/Product.js';
import Review from '../models/Review.js';
import {
  getProductReviews,
  updateReview,
} from '../controllers/reviewController.js';

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

test('review updates cannot change approval or ownership fields', async () => {
  const originalFindOne = Review.findOne;
  const originalFind = Review.find;
  const originalProductUpdate = Product.findByIdAndUpdate;
  const review = {
    _id: '507f1f77bcf86cd799439011',
    user: 'owner-id',
    product: '507f1f77bcf86cd799439012',
    order: '507f1f77bcf86cd799439013',
    rating: 3,
    isApproved: false,
    async save() {},
  };
  const response = createResponse();
  let productStats;

  Review.findOne = async () => review;
  Review.find = async () => [{ rating: 4 }];
  Product.findByIdAndUpdate = async (productId, updates) => {
    productStats = { productId, updates };
  };

  try {
    await updateReview(
      {
        params: { id: review._id },
        user: { _id: 'owner-id' },
        body: { rating: 4, isApproved: true, user: 'other-user' },
      },
      response,
      (error) => {
        throw error;
      },
    );
  } finally {
    Review.findOne = originalFindOne;
    Review.find = originalFind;
    Product.findByIdAndUpdate = originalProductUpdate;
  }

  assert.equal(review.rating, 4);
  assert.equal(review.isApproved, false);
  assert.equal(review.user, 'owner-id');
  assert.deepEqual(productStats.updates, { rating: 4, reviewCount: 1 });
});

test('public product review list filters out unapproved reviews', async () => {
  const originalFind = Review.find;
  const response = createResponse();
  let query;

  Review.find = (filter) => {
    query = filter;
    return {
      populate() {
        return this;
      },
      async sort() {
        return [];
      },
    };
  };

  try {
    await getProductReviews(
      { params: { productId: '507f1f77bcf86cd799439012' } },
      response,
      (error) => {
        throw error;
      },
    );
  } finally {
    Review.find = originalFind;
  }

  assert.deepEqual(query, {
    product: '507f1f77bcf86cd799439012',
    isApproved: true,
  });
  assert.equal(response.statusCode, 200);
});
