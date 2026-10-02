import test from 'node:test';
import assert from 'node:assert/strict';
import Product from '../models/Product.js';
import {
  findActiveVariant,
  getVariantPrice,
  reserveVariantStock,
  releaseVariantStock,
} from '../utils/productUtils.js';

test('variant helpers match active options and prefer sale price', () => {
  const product = {
    variants: [
      {
        size: 'M',
        color: 'Black',
        price: 1200,
        salePrice: 900,
        stock: 4,
        isActive: true,
      },
      {
        size: 'L',
        color: 'Black',
        price: 1200,
        stock: 4,
        isActive: false,
      },
    ],
  };

  const variant = findActiveVariant(product, ' m ', 'black');
  assert.equal(getVariantPrice(variant), 900);
  assert.equal(findActiveVariant(product, 'L', 'Black'), null);
});

test('stock helpers update the selected active variant atomically', async () => {
  const originalUpdateOne = Product.updateOne;
  const updates = [];
  Product.updateOne = async (filter, update) => {
    updates.push({ filter, update });
    return { modifiedCount: 1 };
  };

  try {
    assert.equal(
      await reserveVariantStock('product-id', 'variant-id', 2),
      true,
    );
    assert.equal(
      await releaseVariantStock('product-id', 'variant-id', 2),
      true,
    );
  } finally {
    Product.updateOne = originalUpdateOne;
  }

  assert.deepEqual(updates[0].update, { $inc: { 'variants.$.stock': -2 } });
  assert.deepEqual(updates[1].update, { $inc: { 'variants.$.stock': 2 } });
});
