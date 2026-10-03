import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Address from '../models/Address.js';
import Cart from '../models/Cart.js';
import { successResponse, errorResponse } from '../utils/response.js';
import recordAuditLog from '../utils/auditLog.js';
import {
  findActiveVariant,
  getVariantPrice,
  reserveVariantStock,
  releaseVariantStock,
} from '../utils/productUtils.js';

const generateOrderNumber = () => `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const restoreReservedStock = async (items) =>
  Promise.allSettled(
    items.map(({ product, variant, quantity }) =>
      releaseVariantStock(product, variant, quantity),
    ),
  );

export const createOrder = async (req, res, next) => {
  const reservedItems = [];
  let createdOrderId;

  try {
    const {
      shippingAddressId,
      paymentMethod = 'cod',
      items,
    } = req.body ?? {};

    if (!shippingAddressId) return errorResponse(res, 'Shipping address is required', 400);
    if (!['cod', 'razorpay'].includes(paymentMethod)) {
      return errorResponse(res, 'Unsupported payment method', 400);
    }

    const address = await Address.findOne({ _id: shippingAddressId, user: req.user._id });
    if (!address) return errorResponse(res, 'Shipping address not found', 404);

    let requestedItems = items;
    if (requestedItems === undefined || (Array.isArray(requestedItems) && !requestedItems.length)) {
      const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
      requestedItems = (cart?.items || []).map((item) => ({
        product: item.product?._id,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
      }));
    }

    if (!Array.isArray(requestedItems)) {
      return errorResponse(res, 'Order items must be an array', 400);
    }
    if (!requestedItems.length) return errorResponse(res, 'Order items are required', 400);

    const aggregatedItems = new Map();
    for (const item of requestedItems) {
      const productId = String(item?.product || '');
      const size = String(item?.size || '').trim();
      const color = String(item?.color || '').trim();
      const quantity = Number(item?.quantity);

      if (!mongoose.Types.ObjectId.isValid(productId) || !size || !color) {
        return errorResponse(res, 'Each order item requires a valid product, size, and color', 400);
      }
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        return errorResponse(res, 'Item quantity must be a positive integer', 400);
      }

      const key = `${productId}:${size.toLowerCase()}:${color.toLowerCase()}`;
      const existingItem = aggregatedItems.get(key);
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        aggregatedItems.set(key, { productId, size, color, quantity });
      }
    }

    const orderItems = [];
    let subtotal = 0;
    for (const item of aggregatedItems.values()) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        return errorResponse(res, 'One or more products are not available', 404);
      }

      const variant = findActiveVariant(product, item.size, item.color);
      if (!variant) return errorResponse(res, 'One or more product variants are not available', 404);
      if (variant.stock < item.quantity) {
        return errorResponse(res, 'Insufficient stock for one or more products', 400);
      }

      const price = getVariantPrice(variant);
      orderItems.push({
        product: product._id,
        variant: variant._id,
        name: product.name,
        size: variant.size,
        color: variant.color,
        quantity: item.quantity,
        price,
      });
      subtotal += price * item.quantity;
    }

    const shippingCharge = subtotal > 2000 ? 0 : 100;
    const totalAmount = subtotal + shippingCharge;

    for (const item of orderItems) {
      const reserved = await reserveVariantStock(
        item.product,
        item.variant,
        item.quantity,
      );
      if (!reserved) {
        await restoreReservedStock(reservedItems);
        reservedItems.length = 0;
        return errorResponse(res, 'Insufficient stock for one or more products', 400);
      }
      reservedItems.push(item);
    }

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
      paymentStatus: 'pending',
      orderStatus: 'pending',
    });
    createdOrderId = order._id;

    await recordAuditLog(req, {
      action: 'order.created',
      resource: 'order',
      resourceId: order._id,
      description: `Order ${order.orderNumber} was placed`,
      metadata: { orderNumber: order.orderNumber, totalAmount: order.totalAmount },
    });
    if (paymentMethod !== 'razorpay') {
      await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });
    }
    reservedItems.length = 0;

    return successResponse(res, 'Order created successfully', order, 201);
  } catch (error) {
    if (createdOrderId) {
      await Order.findByIdAndDelete(createdOrderId).catch(() => {});
    }
    await restoreReservedStock(reservedItems);
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

    if (order.orderStatus !== 'pending' || order.paymentStatus === 'paid') {
      return errorResponse(res, 'Only unpaid pending orders can be cancelled', 409);
    }
    if (order.paymentMethod === 'razorpay' && order.razorpayOrderId) {
      return errorResponse(res, 'A Razorpay payment attempt is in progress', 409);
    }

    order.orderStatus = 'cancelled';
    await order.save();
    await restoreReservedStock(
      order.items.filter((item) => item.variant),
    );
    await recordAuditLog(req, {
      action: 'order.cancelled',
      resource: 'order',
      resourceId: order._id,
      description: `Order ${order.orderNumber} was cancelled`,
      metadata: { orderNumber: order.orderNumber },
    });

    return successResponse(res, 'Order cancelled successfully', order);
  } catch (error) {
    next(error);
  }
};
