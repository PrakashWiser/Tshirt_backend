import crypto from 'crypto';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import { successResponse, errorResponse } from '../utils/response.js';
import recordAuditLog from '../utils/auditLog.js';

const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

export const createPaymentOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body ?? {};

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return errorResponse(res, 'A valid orderId is required', 400);
    }

    const existingOrder = await Order.findOne({
      _id: orderId,
      user: req.user._id,
    });
    if (!existingOrder) {
      return errorResponse(res, 'Order not found', 404);
    }
    if (existingOrder.paymentMethod !== 'razorpay') {
      return errorResponse(res, 'This order is not configured for Razorpay', 400);
    }
    if (
      existingOrder.orderStatus !== 'pending' ||
      existingOrder.paymentStatus !== 'pending'
    ) {
      return errorResponse(res, 'This order is not awaiting payment', 409);
    }

    const amount = Math.round(existingOrder.totalAmount * 100);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      return errorResponse(res, 'Order amount is invalid', 400);
    }

    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return errorResponse(res, 'Razorpay credentials are not configured', 500);
    }

    if (existingOrder.razorpayOrderId) {
      return successResponse(res, 'Razorpay order created successfully', {
        orderId: existingOrder.razorpayOrderId,
        amount,
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID,
      });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: existingOrder.orderNumber,
    });

    existingOrder.razorpayOrderId = razorpayOrder.id;
    await existingOrder.save();

    return successResponse(res, 'Razorpay order created successfully', {
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body ?? {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return errorResponse(res, 'Payment verification data is incomplete', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return errorResponse(res, 'A valid orderId is required', 400);
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return errorResponse(res, 'Razorpay credentials are not configured', 500);
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    const expectedSignatureBytes = Buffer.from(expectedSignature, 'hex');
    const providedSignatureBytes = Buffer.from(razorpay_signature, 'hex');
    if (
      expectedSignatureBytes.length !== providedSignatureBytes.length ||
      !crypto.timingSafeEqual(expectedSignatureBytes, providedSignatureBytes)
    ) {
      return errorResponse(res, 'Payment verification failed', 400);
    }

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
    });
    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }
    if (
      order.paymentMethod !== 'razorpay' ||
      order.razorpayOrderId !== razorpay_order_id ||
      order.orderStatus !== 'pending'
    ) {
      return errorResponse(res, 'Payment does not match this order', 400);
    }
    if (order.paymentStatus !== 'pending') {
      return errorResponse(res, 'This order is not awaiting payment', 409);
    }

    order.paymentStatus = 'paid';
    order.orderStatus = 'confirmed';
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    await order.save();
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });
    await recordAuditLog(req, {
      action: 'order.payment_verified',
      resource: 'order',
      resourceId: order._id,
      description: `Payment was verified for order ${order.orderNumber}`,
      metadata: { orderNumber: order.orderNumber, totalAmount: order.totalAmount },
    });

    return successResponse(res, 'Payment verified successfully', order);
  } catch (error) {
    next(error);
  }
};
