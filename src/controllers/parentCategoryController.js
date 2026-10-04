import mongoose from "mongoose";
import Category from "../models/Category.js";
import { successResponse, errorResponse } from "../utils/response.js";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../utils/cloudinaryUpload.js";
import {
  buildCategoryScopeKey,
  buildCategorySlug,
  findDuplicateCategoryName,
  parseCategoryStatus,
} from "../utils/categoryHierarchy.js";

const serializeParentCategory = (category) => {
  const data = category.toObject ? category.toObject() : category;
  return { ...data, status: data.isActive };
};

export const getParentCategories = async (req, res, next) => {
  try {
    const filter = { level: "parent" };
    if (req.query.activeOnly === "true") filter.isActive = true;

    const categories = await Category.find(filter).sort({ name: 1 });
    return successResponse(
      res,
      "Parent categories fetched successfully",
      categories.map(serializeParentCategory),
    );
  } catch (error) {
    next(error);
  }
};

export const getPublicParentCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({
      level: "parent",
      isActive: true,
    }).sort({ name: 1 });

    return successResponse(
      res,
      "Parent categories fetched successfully",
      categories.map(serializeParentCategory),
    );
  } catch (error) {
    next(error);
  }
};

export const createParentCategory = async (req, res, next) => {
  let uploadedImage = null;

  try {
    const body = req.body ?? {};
    const name = String(body.name ?? "").trim();
    if (!name) return errorResponse(res, "Parent category name is required", 400);
    if (await findDuplicateCategoryName(name, null)) {
      return errorResponse(res, "Parent category already exists", 409);
    }

    if (req.files?.image) {
      uploadedImage = await uploadImageToCloudinary(
        req.files.image,
        "tshirt-categories",
      );
    }

    const category = await Category.create({
      name,
      slug: buildCategorySlug(name, null, body.slug || ""),
      level: "parent",
      parentCategory: null,
      scopeKey: buildCategoryScopeKey(null, name),
      description: String(body.description ?? "").trim(),
      image: uploadedImage?.url || "",
      imagePublicId: uploadedImage?.publicId || "",
      isActive: parseCategoryStatus(body.status, body.isActive, true),
    });

    return successResponse(
      res,
      "Parent category created successfully",
      serializeParentCategory(category),
      201,
    );
  } catch (error) {
    if (uploadedImage?.publicId) {
      await deleteImageFromCloudinary(uploadedImage.publicId);
    }
    if (error.code === 11000) {
      return errorResponse(res, "Parent category already exists", 409);
    }
    next(error);
  }
};

export const updateParentCategory = async (req, res, next) => {
  let uploadedImage = null;

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, "Invalid parent category ID", 400);
    }

    const category = await Category.findOne({
      _id: req.params.id,
      level: "parent",
    });
    if (!category) return errorResponse(res, "Parent category not found", 404);
    const oldImagePublicId = category.imagePublicId;

    const body = req.body ?? {};
    const name = body.name === undefined ? category.name : String(body.name).trim();
    if (!name) return errorResponse(res, "Parent category name is required", 400);
    if (await findDuplicateCategoryName(name, null, category._id)) {
      return errorResponse(res, "Parent category already exists", 409);
    }

    if (req.files?.image) {
      uploadedImage = await uploadImageToCloudinary(
        req.files.image,
        "tshirt-categories",
      );
    }

    category.name = name;
    category.description =
      body.description === undefined
        ? category.description
        : String(body.description).trim();
    category.scopeKey = buildCategoryScopeKey(null, name);
    category.isActive = parseCategoryStatus(
      body.status,
      body.isActive,
      category.isActive,
    );
    if (uploadedImage) {
      category.image = uploadedImage.url;
      category.imagePublicId = uploadedImage.publicId;
    }

    await category.save();
    if (uploadedImage?.publicId && oldImagePublicId) {
      await deleteImageFromCloudinary(oldImagePublicId);
    }

    return successResponse(
      res,
      "Parent category updated successfully",
      serializeParentCategory(category),
    );
  } catch (error) {
    if (uploadedImage?.publicId) {
      await deleteImageFromCloudinary(uploadedImage.publicId);
    }
    if (error.code === 11000) {
      return errorResponse(res, "Parent category already exists", 409);
    }
    next(error);
  }
};

export const deleteParentCategory = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, "Invalid parent category ID", 400);
    }

    const category = await Category.findOne({
      _id: req.params.id,
      level: "parent",
    });
    if (!category) return errorResponse(res, "Parent category not found", 404);

    if (await Category.exists({ parentCategory: category._id })) {
      return errorResponse(
        res,
        "Delete related subcategories before deleting this parent category",
        409,
      );
    }

    await Category.findByIdAndDelete(category._id);
    if (category.imagePublicId) {
      await deleteImageFromCloudinary(category.imagePublicId);
    }

    return successResponse(res, "Parent category deleted successfully", null);
  } catch (error) {
    next(error);
  }
};
