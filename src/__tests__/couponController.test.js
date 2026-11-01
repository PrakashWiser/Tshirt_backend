import test from 'node:test';
import assert from 'node:assert/strict';
import AuditLog from '../models/AuditLog.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import { createCoupon } from '../controllers/couponController.js';

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

test('creating an active coupon sends a push and reports the accepted device count', async () => {
  const originalCouponCreate = Coupon.create;
  const originalAuditLogCreate = AuditLog.create;
  const originalUserFind = User.find;
  const originalFetch = globalThis.fetch;
  const coupon = {
    _id: 'coupon-id',
    title: 'Weekend sale',
    code: 'SAVE20',
    discountType: 'percentage',
    discountValue: 20,
    isActive: true,
  };
  const response = createResponse();
  let sentMessages;

  Coupon.create = async () => coupon;
  AuditLog.create = async () => ({});
  User.find = () => ({
    select: async () => [{ expoPushToken: 'ExponentPushToken[customer]' }],
  });
  globalThis.fetch = async (_url, options) => {
    sentMessages = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }] }),
    };
  };

  try {
    await createCoupon({ body: {}, user: { _id: 'admin-id' } }, response, (error) => {
      throw error;
    });
  } finally {
    Coupon.create = originalCouponCreate;
    AuditLog.create = originalAuditLogCreate;
    User.find = originalUserFind;
    globalThis.fetch = originalFetch;
  }

  assert.equal(response.statusCode, 201);
  assert.match(response.body.message, /accepted by Expo for 1 of 1 customer devices/);
  assert.equal(sentMessages[0].data.code, 'SAVE20');
});

test('coupon creation succeeds with an explicit warning when there are no registered devices', async () => {
  const originalCouponCreate = Coupon.create;
  const originalAuditLogCreate = AuditLog.create;
  const originalUserFind = User.find;
  const coupon = {
    _id: 'coupon-id',
    title: 'Weekend sale',
    code: 'SAVE20',
    discountType: 'percentage',
    discountValue: 20,
    isActive: true,
  };
  const response = createResponse();

  Coupon.create = async () => coupon;
  AuditLog.create = async () => ({});
  User.find = () => ({ select: async () => [] });

  try {
    await createCoupon({ body: {}, user: { _id: 'admin-id' } }, response, (error) => {
      throw error;
    });
  } finally {
    Coupon.create = originalCouponCreate;
    AuditLog.create = originalAuditLogCreate;
    User.find = originalUserFind;
  }

  assert.equal(response.statusCode, 201);
  assert.match(response.body.message, /No customer devices are registered/);
});
