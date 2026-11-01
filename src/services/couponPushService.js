import User from '../models/User.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_MESSAGE_BATCH_SIZE = 100;

export const sendCouponPushToCustomers = async (coupon) => {
  const users = await User.find({
    role: 'user',
    isActive: true,
    expoPushToken: { $exists: true, $nin: [null, ''] },
  }).select('expoPushToken');
  const tokens = [...new Set(users.map((user) => user.expoPushToken).filter(Boolean))];

  if (tokens.length === 0) {
    return { total: 0, sent: 0, failed: 0 };
  }

  const discount = coupon.discountType === 'percentage'
    ? `${coupon.discountValue}% off`
    : `₹${coupon.discountValue} off`;
  let sent = 0;

  for (let index = 0; index < tokens.length; index += EXPO_MESSAGE_BATCH_SIZE) {
    const batch = tokens.slice(index, index + EXPO_MESSAGE_BATCH_SIZE);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch.map((token) => ({
        to: token,
        sound: 'default',
        channelId: 'offers',
        title: coupon.title,
        body: `Use code ${coupon.code} for ${discount}.`,
        data: {
          type: 'coupon',
          couponId: String(coupon._id),
          code: coupon.code,
        },
      }))),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.message || `Expo push send failed (${response.status}).`);
    }

    if (!Array.isArray(result?.data)) {
      throw new Error('Expo push service returned an invalid response.');
    }

    sent += result.data.filter((ticket) => ticket.status === 'ok').length;
  }

  return { total: tokens.length, sent, failed: tokens.length - sent };
};
