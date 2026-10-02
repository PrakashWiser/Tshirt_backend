import mongoose from "mongoose";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { successResponse, errorResponse } from "../utils/response.js";
import {
  buildCategoryScopeKey,
  buildCategorySlug,
  findDuplicateCategoryName,
  parseCategoryStatus,
} from "../utils/categoryHierarchy.js";

const serializeSubCategory = (category) => {
  const data = category.toObject ? category.toObject() : category;
  const parentCategoryId =
    data.parentCategory?._id || data.parentCategory || null;

  return {
    ...data,
    parentCategoryId: String(parentCategoryId || ""),
    status: data.isActive,
  };
};

const getParentCategory = async (parentCategoryId) => {
  if (!mongoose.Types.ObjectId.isValid(parentCategoryId)) return null;

  return Category.findOne({
    _id: parentCategoryId,
    level: "parent",
  });
};

export const getSubCategories = async (req, res, next) => {
  try {
    const filter = { level: "sub" };
    if (req.query.activeOnly === "true") filter.isActive = true;

    let subCategories = await Category.find(filter)
      .populate("parentCategory", "name slug level isActive")
      .sort({ name: 1 });

    if (req.query.activeOnly === "true") {
      subCategories = subCategories.filter(
        (subCategory) =>
          subCategory.parentCategory?.level === "parent" &&
          subCategory.parentCategory.isActive,
      );
    }

    return successResponse(
      res,
      "Subcategories fetched successfully",
      subCategories.map(serializeSubCategory),
    );
  } catch (error) {
    next(error);
  }
};

export const createSubCategory = async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const name = String(body.name ?? "").trim();
    const parentCategoryId = body.parentCategoryId;
    if (!name) return errorResponse(res, "Subcategory name is required", 400);

    const parentCategory = await getParentCategory(parentCategoryId);
    if (!parentCategory?.isActive) {
      return errorResponse(res, "Select an active parent category", 400);
    }
    if (await findDuplicateCategoryName(name, parentCategory._id)) {
      return errorResponse(
        res,
        "A subcategory with this name already exists under this parent",
        409,
      );
    }

    const subCategory = await Category.create({
      name,
      slug: buildCategorySlug(name, parentCategory),
      level: "sub",
      parentCategory: parentCategory._id,
      scopeKey: buildCategoryScopeKey(parentCategory._id, name),
      description: String(body.description ?? "").trim(),
      isActive: parseCategoryStatus(body.status, body.isActive, true),
    });

    return successResponse(
      res,
      "Subcategory created successfully",
      serializeSubCategory(subCategory),
      201,
    );
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse(
        res,
        "A subcategory with this name already exists under this parent",
        409,
      );
    }
    next(error);
  }
};

export const updateSubCategory = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, "Invalid subcategory ID", 400);
    }

    const subCategory = await Category.findOne({
      _id: req.params.id,
      level: "sub",
    });
    if (!subCategory) return errorResponse(res, "Subcategory not found", 404);

    const body = req.body ?? {};
    const name =
      body.name === undefined ? subCategory.name : String(body.name).trim();
    const parentCategoryId =
      body.parentCategoryId === undefined
        ? subCategory.parentCategory
        : body.parentCategoryId;
    if (!name) return errorResponse(res, "Subcategory name is required", 400);

    const parentCategory = await getParentCategory(parentCategoryId);
    if (!parentCategory) {
      return errorResponse(res, "Select a valid parent category", 400);
    }
    const parentChanged =
      String(parentCategory._id) !== String(subCategory.parentCategory);
    if (!parentCategory.isActive && parentChanged) {
      return errorResponse(res, "Select an active parent category", 400);
    }
    if (
      await findDuplicateCategoryName(
        name,
        parentCategory._id,
        subCategory._id,
      )
    ) {
      return errorResponse(
        res,
        "A subcategory with this name already exists under this parent",
        409,
      );
    }

    subCategory.name = name;
    subCategory.parentCategory = parentCategory._id;
    subCategory.scopeKey = buildCategoryScopeKey(parentCategory._id, name);
    subCategory.description =
      body.description === undefined
        ? subCategory.description
        : String(body.description).trim();
    subCategory.isActive = parseCategoryStatus(
      body.status,
      body.isActive,
      subCategory.isActive,
    );

    await subCategory.save();

    return successResponse(
      res,
      "Subcategory updated successfully",
      serializeSubCategory(subCategory),
    );
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse(
        res,
        "A subcategory with this name already exists under this parent",
        409,
      );
    }
    next(error);
  }
};

export const deleteSubCategory = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, "Invalid subcategory ID", 400);
    }

    const subCategory = await Category.findOne({
      _id: req.params.id,
      level: "sub",
    });
    if (!subCategory) return errorResponse(res, "Subcategory not found", 404);

    if (await Category.exists({ parentCategory: subCategory._id })) {
      return errorResponse(
        res,
        "Reassign existing linked records before deleting this subcategory",
        409,
      );
    }
    if (await Product.exists({ category: subCategory._id })) {
      return errorResponse(
        res,
        "Remove this subcategory from products before deleting it",
        409,
      );
    }

    await Category.findByIdAndDelete(subCategory._id);
    return successResponse(res, "Subcategory deleted successfully", null);
  } catch (error) {
    next(error);
  }
};
