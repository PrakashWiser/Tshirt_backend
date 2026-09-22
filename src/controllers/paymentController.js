import crypto from 'crypto';
import Razorpay from 'razorpay';
import Order from '../models/Order.js';
import { successResponse, errorResponse } from '../utils/response.js';

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
    const { amount, currency = 'INR', orderId } = req.body;

    if (!amount || !orderId) {
      return errorResponse(res, 'Amount and orderId are required', 400);
    }

    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) {
      return errorResponse(res, 'Order not found', 404);
    }

    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return errorResponse(res, 'Razorpay credentials are not configured', 500);
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Number(amount) * 100,
      currency,
      receipt: `receipt_${orderId}`,
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return errorResponse(res, 'Payment verification data is incomplete', 400);
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

    if (expectedSignature !== razorpay_signature) {
      return errorResponse(res, 'Payment verification failed', 400);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }

    order.paymentStatus = 'paid';
    order.orderStatus = 'confirmed';
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    await order.save();

    return successResponse(res, 'Payment verified successfully', order);
  } catch (error) {
    next(error);
  }
};
