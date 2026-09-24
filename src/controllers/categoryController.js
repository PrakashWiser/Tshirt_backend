import Category from "../models/Category.js";
import { successResponse, errorResponse } from "../utils/response.js";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../utils/cloudinaryUpload.js";

export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({
      isActive: true,
    }).sort({
      createdAt: -1,
    });

    return successResponse(res, "Categories fetched successfully", categories);
  } catch (error) {
    next(error);
  }
};

export const getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({
      slug: req.params.slug,
      isActive: true,
    });

    if (!category) {
      return errorResponse(res, "Category not found", 404);
    }

    return successResponse(res, "Category fetched successfully", category);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  let uploadedImage = null;

  try {
    const { name, slug, description, isActive } = req.body;

    if (!name?.trim()) {
      return errorResponse(res, "Category name is required", 400);
    }

    const file = req.files?.image;

    if (!file) {
      return errorResponse(res, "Image is required", 400);
    }

    uploadedImage = await uploadImageToCloudinary(file, "tshirt-categories");

    const category = await Category.create({
      name: name.trim(),
      slug: slug?.trim(),
      description: description?.trim() || "",
      image: uploadedImage.url,
      imagePublicId: uploadedImage.publicId,
      isActive: isActive === true || isActive === "true",
    });

    return successResponse(res, "Category created successfully", category, 201);
  } catch (error) {
    if (uploadedImage?.publicId) {
      await deleteImageFromCloudinary(uploadedImage.publicId);
    }

    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  let newUploadedImage = null;

  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return errorResponse(res, "Category not found", 404);
    }

    const oldImagePublicId = category.imagePublicId;

    const { name, slug, description, isActive } = req.body;

    if (!name?.trim()) {
      return errorResponse(res, "Category name is required", 400);
    }

    const updateData = {
      name: name.trim(),
      slug: slug?.trim(),
      description: description?.trim() || "",
      isActive: isActive === true || isActive === "true",
    };

    const newImage = req.files?.image;

    if (newImage) {
      newUploadedImage = await uploadImageToCloudinary(
        newImage,
        "tshirt-categories",
      );

      updateData.image = newUploadedImage.url;
      updateData.imagePublicId = newUploadedImage.publicId;
    }
    Object.assign(category, updateData);
    await category.save();
    if (newUploadedImage?.publicId && oldImagePublicId) {
      await deleteImageFromCloudinary(oldImagePublicId);
    }
    return successResponse(res, "Category updated successfully", category);
  } catch (error) {
    if (newUploadedImage?.publicId) {
      await deleteImageFromCloudinary(newUploadedImage.publicId);
    }

    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return errorResponse(res, "Category not found", 404);
    }
    await Category.findByIdAndDelete(req.params.id);
    if (category.imagePublicId) {
      await deleteImageFromCloudinary(category.imagePublicId);
    }
    return successResponse(res, "Category deleted successfully", null);
  } catch (error) {
    next(error);
  }
};
