import crypto from 'crypto';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Address from '../models/Address.js';
import Cart from '../models/Cart.js';
import { successResponse, errorResponse } from '../utils/response.js';

const generateOrderNumber = () => `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export const createOrder = async (req, res, next) => {
  try {
    const { shippingAddressId, paymentMethod = 'cod', items, couponCode } = req.body;

    if (!shippingAddressId) return errorResponse(res, 'Shipping address is required', 400);

    const address = await Address.findOne({ _id: shippingAddressId, user: req.user._id });
    if (!address) return errorResponse(res, 'Shipping address not found', 404);

    let orderItems = items || [];
    if (!orderItems.length) {
      const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
      orderItems = (cart?.items || []).map((item) => ({
        product: item.product._id,
        name: item.product.name,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: item.price,
      }));
    }

    if (!orderItems.length) return errorResponse(res, 'Order items are required', 400);

    let subtotal = 0;
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product) return errorResponse(res, 'One or more products are not available', 404);
      if (product.stock < item.quantity) return errorResponse(res, 'Insufficient stock for one or more products', 400);
      subtotal += item.price * item.quantity;
    }

    const shippingCharge = subtotal > 2000 ? 0 : 100;
    const totalAmount = subtotal + shippingCharge;

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      user: req.user._id,
      items: orderItems,
      shippingAddress: {
        fullName: address.fullName,
        mobile: address.mobile,
        address: address.address,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country,
      },
      subtotal,
      discount: 0,
      shippingCharge,
      totalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === 'razorpay' ? 'pending' : 'paid',
      orderStatus: 'pending',
    });

    if (paymentMethod !== 'razorpay') {
      await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });
    }

    return successResponse(res, 'Order created successfully', order, 201);
  } catch (error) {
    next(error);
  }
};

export const getOrders = async (req, res, next) => {
  try {
    const query = req.user.role === 'admin' ? {} : { user: req.user._id };
    const orders = await Order.find(query).sort({ createdAt: -1 }).populate('user', 'name email');
    return successResponse(res, 'Orders fetched successfully', orders);
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return errorResponse(res, 'Order not found', 404);

    if (req.user.role !== 'admin' && order.user._id.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'You are not authorized to view this order', 403);
    }

    return successResponse(res, 'Order fetched successfully', order);
  } catch (error) {
    next(error);
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return errorResponse(res, 'Order not found', 404);

    if (req.user.role !== 'admin' && order.user.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'You are not authorized to cancel this order', 403);
    }

    order.orderStatus = 'cancelled';
    order.paymentStatus = order.paymentStatus === 'paid' ? 'refunded' : order.paymentStatus;
    await order.save();

    return successResponse(res, 'Order cancelled successfully', order);
  } catch (error) {
    next(error);
  }
};
