import test from 'node:test';
import assert from 'node:assert/strict';
import Address from '../models/Address.js';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import AuditLog from '../models/AuditLog.js';
import { cancelOrder, createOrder } from '../controllers/orderController.js';

test('createOrder calculates prices from variants and combines duplicate lines', async () => {
  const originalAddressFindOne = Address.findOne;
  const originalCartFindOneAndUpdate = Cart.findOneAndUpdate;
  const originalOrderCreate = Order.create;
  const originalProductFindById = Product.findById;
  const originalProductUpdateOne = Product.updateOne;
  const originalAuditLogCreate = AuditLog.create;
  const productId = '507f1f77bcf86cd799439011';
  const product = {
    _id: productId,
    name: 'Classic Tee',
    isActive: true,
    variants: [
      {
        _id: '507f1f77bcf86cd799439012',
        size: 'M',
        color: 'Black',
        price: 1200,
        salePrice: 900,
        stock: 5,
        isActive: true,
      },
    ],
  };
  const address = {
    fullName: 'Test User',
    mobile: '1234567890',
    address: '1 Main St',
    city: 'Test City',
    state: 'Test State',
    pincode: '12345',
    country: 'IN',
  };
  const response = {
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
  };
  let createdOrder;
  let stockReservation;

  Address.findOne = async () => address;
  Cart.findOneAndUpdate = async () => {};
  Order.create = async (data) => {
    createdOrder = data;
    return data;
  };
  Product.findById = async () => product;
  AuditLog.create = async () => ({});
  Product.updateOne = async (filter, update) => {
    stockReservation = { filter, update };
    return { modifiedCount: 1 };
  };

  try {
    await createOrder(
      {
        user: { _id: '507f1f77bcf86cd799439013' },
        body: {
          shippingAddressId: '507f1f77bcf86cd799439014',
          paymentMethod: 'cod',
          items: [
            { product: productId, size: 'M', color: 'Black', quantity: 1, price: 1 },
            { product: productId, size: 'm', color: 'black', quantity: 1, price: 1 },
          ],
        },
      },
      response,
      (error) => {
        throw error;
      },
    );
  } finally {
    Address.findOne = originalAddressFindOne;
    Cart.findOneAndUpdate = originalCartFindOneAndUpdate;
    Order.create = originalOrderCreate;
    Product.findById = originalProductFindById;
    Product.updateOne = originalProductUpdateOne;
    AuditLog.create = originalAuditLogCreate;
  }

  assert.equal(response.statusCode, 201);
  assert.equal(createdOrder.items.length, 1);
  assert.equal(createdOrder.items[0].price, 900);
  assert.equal(createdOrder.items[0].quantity, 2);
  assert.equal(createdOrder.items[0].variant, product.variants[0]._id);
  assert.equal(createdOrder.subtotal, 1800);
  assert.equal(createdOrder.paymentStatus, 'pending');
  assert.deepEqual(stockReservation.update, {
    $inc: { 'variants.$.stock': -2 },
  });
});

test('cancelOrder rejects paid orders instead of marking them refunded', async () => {
  const originalFindById = Order.findById;
  const originalProductUpdateOne = Product.updateOne;
  const order = {
    user: 'owner-id',
    orderStatus: 'confirmed',
    paymentStatus: 'paid',
    paymentMethod: 'razorpay',
    items: [],
    async save() {
      assert.fail('Paid orders must not be cancelled without a refund');
    },
  };
  const response = {
    statusCode: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  Order.findById = async () => order;
  Product.updateOne = async () => {
    assert.fail('Paid orders must not release reserved stock');
  };

  try {
    await cancelOrder(
      {
        params: { id: 'order-id' },
        user: { _id: 'owner-id', role: 'user' },
      },
      response,
      (error) => {
        throw error;
      },
    );
  } finally {
    Order.findById = originalFindById;
    Product.updateOne = originalProductUpdateOne;
  }

  assert.equal(response.statusCode, 409);
  assert.equal(order.paymentStatus, 'paid');
  assert.equal(order.orderStatus, 'confirmed');
});
