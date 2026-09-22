import Category from '../models/Category.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ createdAt: -1 });
    return successResponse(res, 'Categories fetched successfully', categories);
  } catch (error) {
    next(error);
  }
};

export const getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug, isActive: true });
    if (!category) return errorResponse(res, 'Category not found', 404);
    return successResponse(res, 'Category fetched successfully', category);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const category = await Category.create(req.body);
    return successResponse(res, 'Category created successfully', category, 201);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return errorResponse(res, 'Category not found', 404);

    Object.assign(category, req.body);
    await category.save();

    return successResponse(res, 'Category updated successfully', category);
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return errorResponse(res, 'Category not found', 404);
    return successResponse(res, 'Category deleted successfully', null);
  } catch (error) {
    next(error);
  }
};
