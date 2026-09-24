import Banner from "../models/Banner.js";
import { successResponse, errorResponse } from "../utils/response.js";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../utils/cloudinaryUpload.js";

export const getActiveBanners = async (req, res, next) => {
  try {
    const banners = await Banner.find({
      isActive: true,
    }).sort({
      sortOrder: 1,
      createdAt: -1,
    });

    return successResponse(res, "Banners fetched successfully", banners);
  } catch (error) {
    next(error);
  }
};

export const getAllBanners = async (req, res, next) => {
  try {
    const banners = await Banner.find().sort({
      sortOrder: 1,
      createdAt: -1,
    });

    return successResponse(res, "All banners fetched successfully", banners);
  } catch (error) {
    next(error);
  }
};

export const getBannerById = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return errorResponse(res, "Banner not found", 404);
    }
    return successResponse(res, "Banner fetched successfully", banner);
  } catch (error) {
    next(error);
  }
};

export const createBanner = async (req, res, next) => {
  let uploadedImage = null;

  try {
    const { title, subtitle, link, isActive, sortOrder } = req.body;
    if (!title?.trim()) {
      return errorResponse(res, "Title is required", 400);
    }
    const file = req.files?.image;
    if (!file) {
      return errorResponse(res, "Image is required", 400);
    }

    uploadedImage = await uploadImageToCloudinary(file, "tshirt-banners");
    const banner = await Banner.create({
      title: title.trim(),
      subtitle: subtitle?.trim() || "",
      image: uploadedImage.url,
      imagePublicId: uploadedImage.publicId,
      link: link?.trim() || "/",
      isActive: isActive === true || isActive === "true",
      sortOrder: Number(sortOrder || 0),
    });

    return successResponse(res, "Banner created successfully", banner, 201);
  } catch (error) {
    if (uploadedImage?.publicId) {
      await deleteImageFromCloudinary(uploadedImage.publicId);
    }

    next(error);
  }
};

export const updateBanner = async (req, res, next) => {
  let newUploadedImage = null;

  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return errorResponse(res, "Banner not found", 404);
    }

    const oldImagePublicId = banner.imagePublicId;
    const { title, subtitle, link, isActive, sortOrder } = req.body;
    if (!title?.trim()) {
      return errorResponse(res, "Title is required", 400);
    }

    const updateData = {
      title: title.trim(),
      subtitle: subtitle?.trim() || "",
      link: link?.trim() || "/",
      isActive: isActive === true || isActive === "true",
      sortOrder: Number(sortOrder || 0),
    };

    const newImage = req.files?.image;
    if (newImage) {
      newUploadedImage = await uploadImageToCloudinary(
        newImage,
        "tshirt-banners",
      );

      updateData.image = newUploadedImage.url;
      updateData.imagePublicId = newUploadedImage.publicId;
    }
    Object.assign(banner, updateData);
    await banner.save();
    if (newUploadedImage?.publicId && oldImagePublicId) {
      await deleteImageFromCloudinary(oldImagePublicId);
    }
    return successResponse(res, "Banner updated successfully", banner);
  } catch (error) {
    if (newUploadedImage?.publicId) {
      await deleteImageFromCloudinary(newUploadedImage.publicId);
    }
    next(error);
  }
};

export const deleteBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return errorResponse(res, "Banner not found", 404);
    }
    await Banner.findByIdAndDelete(req.params.id);

    if (banner.imagePublicId) {
      await deleteImageFromCloudinary(banner.imagePublicId);
    }

    return successResponse(res, "Banner deleted successfully", null, 200);
  } catch (error) {
    next(error);
  }
};
