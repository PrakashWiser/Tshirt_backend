import mongoose from "mongoose";
import Category from "../models/Category.js";

export const normalizeCategoryName = (name) =>
  name.trim().toLocaleLowerCase("en");

export const slugifyCategoryName = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export const buildCategoryScopeKey = (parentId, name) =>
  `${parentId ? String(parentId) : "root"}:${normalizeCategoryName(name)}`;

export const parseCategoryStatus = (status, isActive, fallback) => {
  const value = status ?? isActive;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
};

export const buildCategorySlug = (name, parent, providedSlug = "") => {
  const nameSlug = slugifyCategoryName(name);
  if (parent) return `${parent.slug}-${nameSlug}`;
  return providedSlug.trim().toLowerCase() || nameSlug;
};

export const findDuplicateCategoryName = (name, parentId, excludeId = null) => {
  const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = {
    parentCategory: parentId,
    name: new RegExp(`^${escapedName}$`, "i"),
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return Category.exists(filter);
};

export const getProductCategoryError = async (
  categoryId,
  { allowExistingLegacy = false } = {},
) => {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return "Invalid category";
  }

  const category = await Category.findById(categoryId).populate({
    path: "parentCategory",
    select: "level isActive",
  });

  if (!category || !category.isActive) return "Invalid or inactive category";
  if (category.level === "legacy" || !category.level) {
    return allowExistingLegacy ? null : "Select a subcategory";
  }
  if (category.level !== "sub") return "Products must use a subcategory";

  const parentCategory = category.parentCategory;
  if (parentCategory?.level !== "parent" || !parentCategory.isActive) {
    return "The selected parent category is inactive or invalid";
  }

  return null;
};

export const getCategoryAndSubCategoryIds = async (categoryId) => {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) return [];

  const rootId = new mongoose.Types.ObjectId(categoryId);

  const category = await Category.findById(rootId, { _id: 1, level: 1 }).lean();
  if (!category) return [];

  if (category.level !== "parent") {
    return [rootId];
  }

  const subs = await Category.find(
    { parentCategory: rootId, isActive: true },
    { _id: 1 },
  ).lean();

  return [rootId, ...subs.map((sub) => sub._id)];
};
