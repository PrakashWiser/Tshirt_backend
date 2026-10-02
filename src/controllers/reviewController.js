import Order from '../models/Order.js';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import { successResponse, errorResponse } from '../utils/response.js';

const updateProductReviewStats = async (productId) => {
  const reviews = await Review.find({ product: productId, isApproved: true });
  const reviewCount = reviews.length;
  const averageRating =
    reviews.reduce((sum, review) => sum + review.rating, 0) / (reviewCount || 1);

  await Product.findByIdAndUpdate(productId, {
    rating: Number(averageRating.toFixed(1)),
    reviewCount,
  });
};

export const getProductReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({
      product: req.params.productId,
      isApproved: true,
    }).populate('user', 'name').sort({ createdAt: -1 });
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

    await updateProductReviewStats(productId);

    return successResponse(res, 'Review submitted successfully', review, 201);
  } catch (error) {
    next(error);
  }
};

export const updateReview = async (req, res, next) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, user: req.user._id });
    if (!review) return errorResponse(res, 'Review not found', 404);

    const body = req.body ?? {};
    const updates = {};
    for (const field of ['rating', 'comment', 'images']) {
      if (Object.hasOwn(body, field)) updates[field] = body[field];
    }
    if (!Object.keys(updates).length) {
      return errorResponse(res, 'No review fields provided', 400);
    }
    if (updates.images !== undefined && !Array.isArray(updates.images)) {
      return errorResponse(res, 'Review images must be an array', 400);
    }

    Object.assign(review, updates);
    await review.save();
    await updateProductReviewStats(review.product);
    return successResponse(res, 'Review updated successfully', review);
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!review) return errorResponse(res, 'Review not found', 404);

    await updateProductReviewStats(review.product);
    return successResponse(res, 'Review deleted successfully', null);
  } catch (error) {
    next(error);
  }
};
