import Category from '../models/Category.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({
      isActive: true,
      $or: [
        { level: { $in: ['sub', 'legacy'] } },
        { level: { $exists: false } },
      ],
    })
      .populate('parentCategory', 'name slug level isActive')
      .sort({ name: 1 });

    const productCategories = categories.filter(
      (category) => {
        if (category.level === 'legacy' || !category.level) return true;
        return Boolean(
          category.level === 'sub' &&
            category.parentCategory?.level === 'parent' &&
            category.parentCategory.isActive,
        );
      },
    );

    return successResponse(
      res,
      'Categories fetched successfully',
      productCategories,
    );
  } catch (error) {
    next(error);
  }
};

export const getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({
      slug: req.params.slug,
      isActive: true,
      level: { $in: ['sub', 'legacy'] },
    }).populate('parentCategory', 'name slug level isActive');

    if (!category) return errorResponse(res, 'Category not found', 404);
    return successResponse(res, 'Category fetched successfully', category);
  } catch (error) {
    next(error);
  }
};
