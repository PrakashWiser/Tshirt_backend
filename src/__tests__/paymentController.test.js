import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import AuditLog from '../models/AuditLog.js';
import {
  createPaymentOrder,
  verifyPayment,
} from '../controllers/paymentController.js';

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

const createSignature = (orderId, paymentId, secret) =>
  crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

test('createPaymentOrder scopes lookup to the authenticated owner', async () => {
  const originalFindOne = Order.findOne;
  let query;
  const response = createResponse();
  Order.findOne = async (filter) => {
    query = filter;
    return null;
  };

  try {
    await createPaymentOrder(
      {
        user: { _id: '507f1f77bcf86cd799439011' },
        body: {
          orderId: '507f1f77bcf86cd799439012',
          amount: 1,
        },
      },
      response,
      (error) => {
        throw error;
      },
    );
  } finally {
    Order.findOne = originalFindOne;
  }

  assert.deepEqual(query, {
    _id: '507f1f77bcf86cd799439012',
    user: '507f1f77bcf86cd799439011',
  });
  assert.equal(response.statusCode, 404);
});

test('verifyPayment confirms only the owner’s matching pending Razorpay order', async () => {
  const originalOrderFindOne = Order.findOne;
  const originalCartFindOneAndUpdate = Cart.findOneAndUpdate;
  const originalAuditLogCreate = AuditLog.create;
  const originalSecret = process.env.RAZORPAY_KEY_SECRET;
  const secret = 'test-secret';
  const order = {
    paymentMethod: 'razorpay',
    orderStatus: 'pending',
    paymentStatus: 'pending',
    razorpayOrderId: 'razorpay-order-1',
    async save() {},
  };
  let query;
  const response = createResponse();

  process.env.RAZORPAY_KEY_SECRET = secret;
  Order.findOne = async (filter) => {
    query = filter;
    return order;
  };
  Cart.findOneAndUpdate = async () => {};
  AuditLog.create = async () => ({});

  try {
    await verifyPayment(
      {
        user: { _id: '507f1f77bcf86cd799439011' },
        body: {
          orderId: '507f1f77bcf86cd799439012',
          razorpay_order_id: 'razorpay-order-1',
          razorpay_payment_id: 'razorpay-payment-1',
          razorpay_signature: createSignature(
            'razorpay-order-1',
            'razorpay-payment-1',
            secret,
          ),
        },
      },
      response,
      (error) => {
        throw error;
      },
    );
  } finally {
    Order.findOne = originalOrderFindOne;
    Cart.findOneAndUpdate = originalCartFindOneAndUpdate;
    AuditLog.create = originalAuditLogCreate;
    if (originalSecret === undefined) {
      delete process.env.RAZORPAY_KEY_SECRET;
    } else {
      process.env.RAZORPAY_KEY_SECRET = originalSecret;
    }
  }

  assert.deepEqual(query, {
    _id: '507f1f77bcf86cd799439012',
    user: '507f1f77bcf86cd799439011',
  });
  assert.equal(order.paymentStatus, 'paid');
  assert.equal(response.statusCode, 200);
});

test('verifyPayment rejects a signed payment for a different stored order', async () => {
  const originalOrderFindOne = Order.findOne;
  const originalCartFindOneAndUpdate = Cart.findOneAndUpdate;
  const originalSecret = process.env.RAZORPAY_KEY_SECRET;
  const secret = 'test-secret';
  const order = {
    paymentMethod: 'razorpay',
    orderStatus: 'pending',
    paymentStatus: 'pending',
    razorpayOrderId: 'stored-order-id',
    async save() {
      assert.fail('Mismatched payment must not update the order');
    },
  };
  const response = createResponse();

  process.env.RAZORPAY_KEY_SECRET = secret;
  Order.findOne = async () => order;
  Cart.findOneAndUpdate = async () => {};

  try {
    await verifyPayment(
      {
        user: { _id: '507f1f77bcf86cd799439011' },
        body: {
          orderId: '507f1f77bcf86cd799439012',
          razorpay_order_id: 'different-order-id',
          razorpay_payment_id: 'razorpay-payment-1',
          razorpay_signature: createSignature(
            'different-order-id',
            'razorpay-payment-1',
            secret,
          ),
        },
      },
      response,
      (error) => {
        throw error;
      },
    );
  } finally {
    Order.findOne = originalOrderFindOne;
    Cart.findOneAndUpdate = originalCartFindOneAndUpdate;
    if (originalSecret === undefined) {
      delete process.env.RAZORPAY_KEY_SECRET;
    } else {
      process.env.RAZORPAY_KEY_SECRET = originalSecret;
    }
  }

  assert.equal(response.statusCode, 400);
  assert.equal(order.paymentStatus, 'pending');
});
