import Wishlist from '../models/Wishlist.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getWishlist = async (req, res, next) => {
  try {
    const items = await Wishlist.find({ user: req.user._id }).populate('product');
    return successResponse(res, 'Wishlist fetched successfully', items);
  } catch (error) {
    next(error);
  }
};

export const addToWishlist = async (req, res, next) => {
  try {
    const existing = await Wishlist.findOne({ user: req.user._id, product: req.params.productId });
    if (existing) {
      return errorResponse(res, 'Product already exists in wishlist', 409);
    }
    const entry = await Wishlist.create({ user: req.user._id, product: req.params.productId });
    return successResponse(res, 'Product added to wishlist successfully', entry, 201);
  } catch (error) {
    next(error);
  }
};

export const removeFromWishlist = async (req, res, next) => {
  try {
    const removed = await Wishlist.findOneAndDelete({ user: req.user._id, product: req.params.productId });
    if (!removed) return errorResponse(res, 'Wishlist item not found', 404);

    return successResponse(res, 'Product removed from wishlist successfully', null);
  } catch (error) {
    next(error);
  }
};
