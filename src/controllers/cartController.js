import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { successResponse, errorResponse } from '../utils/response.js';

const getUserCart = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate({
    path: 'items.product',
    select: 'name slug price salePrice images stock isActive',
  });
  return cart || { user: userId, items: [] };
};

export const getCart = async (req, res, next) => {
  try {
    const cart = await getUserCart(req.user._id);
    return successResponse(res, 'Cart fetched successfully', cart);
  } catch (error) {
    next(error);
  }
};

export const addToCart = async (req, res, next) => {
  try {
    const { productId, size, color, quantity = 1 } = req.body;
    const product = await Product.findById(productId);

    if (!product) return errorResponse(res, 'Product not found', 404);
    if (!product.isActive) return errorResponse(res, 'This product is currently unavailable', 400);

    const itemQty = Number(quantity);
    if (itemQty < 1) return errorResponse(res, 'Quantity must be at least 1', 400);
    if (product.stock < itemQty) return errorResponse(res, 'Insufficient stock available', 400);

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId && item.size === size && item.color === color
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + itemQty;
      if (product.stock < newQuantity) {
        return errorResponse(res, 'Insufficient stock available', 400);
      }
      existingItem.quantity = newQuantity;
      existingItem.price = product.salePrice > 0 ? product.salePrice : product.price;
    } else {
      cart.items.push({
        product: productId,
        size,
        color,
        quantity: itemQty,
        price: product.salePrice > 0 ? product.salePrice : product.price,
      });
    }
    await cart.save();
    return successResponse(res, 'Item added to cart successfully', cart);
  } catch (error) {
    next(error);
  }
};

export const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const { itemId } = req.params;
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) return errorResponse(res, 'Cart not found', 404);

    const item = cart.items.id(itemId);
    if (!item) return errorResponse(res, 'Cart item not found', 404);

    const product = await Product.findById(item.product);
    if (!product) return errorResponse(res, 'Product not found', 404);

    const nextQty = Number(quantity);
    if (nextQty < 1) return errorResponse(res, 'Quantity must be at least 1', 400);
    if (product.stock < nextQty) return errorResponse(res, 'Insufficient stock available', 400);

    item.quantity = nextQty;
    await cart.save();
    return successResponse(res, 'Cart item updated successfully', cart);
  } catch (error) {
    next(error);
  }
};

export const removeCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) return errorResponse(res, 'Cart not found', 404);

    cart.items = cart.items.filter((item) => item._id.toString() !== itemId);
    await cart.save();
    return successResponse(res, 'Cart item removed successfully', cart);
  } catch (error) {
    next(error);
  }
};

export const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return successResponse(res, 'Cart is already empty', { items: [] });

    cart.items = [];
    await cart.save();
    return successResponse(res, 'Cart cleared successfully', cart);
  } catch (error) {
    next(error);
  }
};
