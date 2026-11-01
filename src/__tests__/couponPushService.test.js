import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/User.js';
import { sendCouponPushToCustomers } from '../services/couponPushService.js';

test('coupon push sends a visible offer notification to active customer devices', async () => {
  const originalFind = User.find;
  const originalFetch = globalThis.fetch;
  const tokens = ['ExponentPushToken[first]', 'ExponentPushToken[second]'];
  let userQuery;
  let request;

  User.find = (query) => {
    userQuery = query;
    return {
      select: async () => tokens.map((expoPushToken) => ({ expoPushToken })),
    };
  };
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }, { status: 'ok' }] }),
    };
  };

  try {
    const result = await sendCouponPushToCustomers({
      _id: 'coupon-id',
      title: 'Weekend sale',
      code: 'SAVE20',
      discountType: 'percentage',
      discountValue: 20,
    });

    assert.deepEqual(userQuery, {
      role: 'user',
      isActive: true,
      expoPushToken: { $exists: true, $nin: [null, ''] },
    });
    assert.deepEqual(result, { total: 2, sent: 2, failed: 0 });
    assert.equal(request.url, 'https://exp.host/--/api/v2/push/send');
    const messages = JSON.parse(request.options.body);
    assert.deepEqual(messages, tokens.map((token) => ({
      to: token,
      sound: 'default',
      channelId: 'offers',
      title: 'Weekend sale',
      body: 'Use code SAVE20 for 20% off.',
      data: { type: 'coupon', couponId: 'coupon-id', code: 'SAVE20' },
    })));
  } finally {
    User.find = originalFind;
    globalThis.fetch = originalFetch;
  }
});

test('coupon push batches device messages at the Expo API limit', async () => {
  const originalFind = User.find;
  const originalFetch = globalThis.fetch;
  const tokens = Array.from({ length: 205 }, (_, index) => `ExponentPushToken[${index}]`);
  const requestSizes = [];

  User.find = () => ({
    select: async () => tokens.map((expoPushToken) => ({ expoPushToken })),
  });
  globalThis.fetch = async (_url, options) => {
    const messages = JSON.parse(options.body);
    requestSizes.push(messages.length);
    return {
      ok: true,
      json: async () => ({ data: messages.map(() => ({ status: 'ok' })) }),
    };
  };

  try {
    const result = await sendCouponPushToCustomers({
      _id: 'coupon-id',
      title: 'Weekend sale',
      code: 'SAVE20',
      discountType: 'fixed',
      discountValue: 100,
    });

    assert.deepEqual(requestSizes, [100, 100, 5]);
    assert.deepEqual(result, { total: 205, sent: 205, failed: 0 });
  } finally {
    User.find = originalFind;
    globalThis.fetch = originalFetch;
  }
});
