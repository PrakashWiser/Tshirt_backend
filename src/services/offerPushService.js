import Offer from '../models/Offer.js';
import User from '../models/User.js';

const EXPOS_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export const sendOfferPushToUsers = async (offer) => {
  const users = await User.find({
    isActive: true,
    expoPushToken: { $exists: true, $ne: null, $ne: '' },
  }).select('expoPushToken name');

  const tokens = users
    .map((user) => user.expoPushToken)
    .filter(Boolean);

  if (!tokens.length) {
    await Offer.findByIdAndUpdate(offer._id, {
      isSent: true,
      sentAt: new Date(),
      lastError: '',
    });
    return { sent: 0, title: offer.title };
  }

  const response = await fetch(EXPOS_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: tokens,
      sound: 'default',
      title: '🔥 Special Offer!',
      body: `${offer.discountPercent}% OFF — Limited Time Offer`,
      data: {
        type: 'offer',
        offerId: String(offer._id),
        title: offer.title,
        message: offer.message || `${offer.discountPercent}% OFF — Limited Time Offer`,
      },
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result?.message || 'Expo push send failed');
  }

  const successful = Array.isArray(result) ? result.filter((item) => item.status === 'ok').length : 0;

  await Offer.findByIdAndUpdate(offer._id, {
    isSent: true,
    sentAt: new Date(),
    lastError: successful > 0 ? '' : 'No Expo push tokens accepted',
  });

  return { sent: successful, title: offer.title, result };
};

export const sendDueOffers = async () => {
  const now = new Date();
  const pendingOffers = await Offer.find({
    isActive: true,
    isSent: false,
    startAt: { $lte: now },
    endAt: { $gt: now },
  }).sort({ startAt: 1 });

  for (const offer of pendingOffers) {
    try {
      await sendOfferPushToUsers(offer);
      // eslint-disable-next-line no-console
      console.log(`Offer notification dispatched: ${offer.title}`);
    } catch (error) {
      await Offer.findByIdAndUpdate(offer._id, {
        lastError: error instanceof Error ? error.message : 'Unknown push error',
      });
      // eslint-disable-next-line no-console
      console.error(`Offer notification failed: ${offer.title}`, error);
    }
  }
};
