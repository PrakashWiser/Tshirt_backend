import Coupon from '../models/Coupon.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getAllCoupons = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
      Coupon.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Coupon.countDocuments(),
    ]);

    return successResponse(res, 'Coupons fetched successfully', {
      coupons,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCouponById = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return errorResponse(res, 'Coupon not found', 404);

    return successResponse(res, 'Coupon fetched successfully', coupon);
  } catch (error) {
    next(error);
  }
};

export const validateCoupon = async (req, res, next) => {
  try {
    const { code, orderTotal = 0 } = req.body;
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) return errorResponse(res, 'Coupon not found or inactive', 404);

    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      return errorResponse(res, 'Coupon is not valid for the current date', 400);
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return errorResponse(res, 'Coupon usage limit reached', 400);
    }

    if (orderTotal < coupon.minimumOrder) {
      return errorResponse(res, 'Order total does not meet coupon minimum', 400);
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (orderTotal * coupon.discountValue) / 100;
      if (coupon.maximumDiscount > 0) {
        discountAmount = Math.min(discountAmount, coupon.maximumDiscount);
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    return successResponse(res, 'Coupon is valid', {
      coupon: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      finalAmount: Math.max(orderTotal - discountAmount, 0),
    });
  } catch (error) {
    next(error);
  }
};

export const createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create(req.body);
    return successResponse(res, 'Coupon created successfully', coupon, 201);
  } catch (error) {
    next(error);
  }
};

export const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return errorResponse(res, 'Coupon not found', 404);

    Object.assign(coupon, req.body);
    await coupon.save();
    return successResponse(res, 'Coupon updated successfully', coupon);
  } catch (error) {
    next(error);
  }
};

export const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return errorResponse(res, 'Coupon not found', 404);

    return successResponse(res, 'Coupon deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

export const updateCouponStatus = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return errorResponse(res, 'Coupon not found', 404);

    coupon.isActive = typeof req.body.isActive === 'boolean'
      ? req.body.isActive
      : coupon.isActive;

    await coupon.save();

    return successResponse(res, 'Coupon status updated successfully', coupon);
  } catch (error) {
    next(error);
  }
};
