import Banner from '../models/Banner.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getActiveBanners = async (req, res, next) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 });
    return successResponse(res, 'Banners fetched successfully', banners);
  } catch (error) {
    next(error);
  }
};

export const getAllBanners = async (req, res, next) => {
  try {
    const banners = await Banner.find().sort({ sortOrder: 1, createdAt: -1 });
    return successResponse(res, 'All banners fetched successfully', banners);
  } catch (error) {
    next(error);
  }
};

export const getBannerById = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return errorResponse(res, 'Banner not found', 404);

    return successResponse(res, 'Banner fetched successfully', banner);
  } catch (error) {
    next(error);
  }
};

export const createBanner = async (req, res, next) => {
  try {
    const { title, image } = req.body;
    if (!title || !image) {
      return errorResponse(res, 'Title and image are required', 400);
    }
    const banner = await Banner.create(req.body);
    return successResponse(res, 'Banner created successfully', banner, 201);
  } catch (error) {
    next(error);
  }
};

export const updateBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return errorResponse(res, 'Banner not found', 404);

    Object.assign(banner, req.body);
    await banner.save();

    return successResponse(res, 'Banner updated successfully', banner);
  } catch (error) {
    next(error);
  }
};

export const deleteBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return errorResponse(res, 'Banner not found', 404);

    return successResponse(res, 'Banner deleted successfully', null, 200);
  } catch (error) {
    next(error);
  }
};
