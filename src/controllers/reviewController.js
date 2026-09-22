import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getProductReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ product: req.params.productId }).populate('user', 'name').sort({ createdAt: -1 });
    return successResponse(res, 'Reviews fetched successfully', reviews);
  } catch (error) {
    next(error);
  }
};

export const createProductReview = async (req, res, next) => {
  try {
    const { rating, comment, images = [] } = req.body;
    const productId = req.params.productId;

    const order = await Order.findOne({
      user: req.user._id,
      'items.product': productId,
      orderStatus: 'delivered',
    });

    if (!order) {
      return errorResponse(res, 'Only verified purchasers can leave a review', 403);
    }

    const review = await Review.create({
      user: req.user._id,
      product: productId,
      order: order._id,
      rating,
      comment,
      images,
    });

    const product = await Product.findById(productId);
    if (product) {
      const reviews = await Review.find({ product: productId, isApproved: true });
      const totalReviews = reviews.length;
      const averageRating = reviews.reduce((sum, item) => sum + item.rating, 0) / (totalReviews || 1);
      product.rating = Number(averageRating.toFixed(1));
      product.reviewCount = totalReviews;
      await product.save();
    }

    return successResponse(res, 'Review submitted successfully', review, 201);
  } catch (error) {
    next(error);
  }
};

export const updateReview = async (req, res, next) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, user: req.user._id });
    if (!review) return errorResponse(res, 'Review not found', 404);

    Object.assign(review, req.body);
    await review.save();
    return successResponse(res, 'Review updated successfully', review);
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!review) return errorResponse(res, 'Review not found', 404);

    return successResponse(res, 'Review deleted successfully', null);
  } catch (error) {
    next(error);
  }
};
