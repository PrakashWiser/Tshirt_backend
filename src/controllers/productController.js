import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { successResponse, errorResponse } from '../utils/response.js';

const buildProductQuery = (query) => {
  const filter = { isActive: true };
  if (query.search) {
    const searchRegex = new RegExp(query.search, 'i');
    filter.$or = [{ name: searchRegex }, { description: searchRegex }, { sku: searchRegex }];
  }

  if (query.category) {
    filter.category = query.category;
  }

  if (query.size) {
    filter.sizes = { $in: [query.size] };
  }

  if (query.color) {
    filter.colors = { $in: [query.color] };
  }

  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }

  if (query.bestSeller === 'true') filter.isBestSeller = true;
  if (query.newArrival === 'true') filter.isNewArrival = true;
  if (query.featured === 'true') filter.isFeatured = true;
  if (query.trending === 'true') filter.isTrending = true;

  return filter;
};

export const getProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, sort = 'createdAt', order = 'desc' } = req.query;
    const query = buildProductQuery(req.query);

    const sortOrder = order === 'asc' ? 1 : -1;
    const sortField = sort === 'price' ? 'price' : sort === 'rating' ? 'rating' : 'createdAt';

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name slug')
        .sort({ [sortField]: sortOrder })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit)),
      Product.countDocuments(query),
    ]);

    return successResponse(res, 'Products fetched successfully', {
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProductBySlug = async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true }).populate('category', 'name slug');
    if (!product) return errorResponse(res, 'Product not found', 404);

    return successResponse(res, 'Product fetched successfully', product);
  } catch (error) {
    next(error);
  }
};

export const getTrendingProducts = async (req, res, next) => {
  try {
    const { limit = 8 } = req.query;
    const products = await Product.find({ isActive: true, isTrending: true })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    return successResponse(res, 'Trending products fetched successfully', products);
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const { category } = req.body;
    const categoryExists = await Category.findById(category);

    if (!categoryExists) {
      return errorResponse(res, 'Invalid category', 400);
    }

    const product = await Product.create(req.body);
    return successResponse(res, 'Product created successfully', product, 201);
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return errorResponse(res, 'Product not found', 404);

    if (req.body.category) {
      const categoryExists = await Category.findById(req.body.category);
      if (!categoryExists) {
        return errorResponse(res, 'Invalid category', 400);
      }
    }

    Object.assign(product, req.body);
    await product.save();

    return successResponse(res, 'Product updated successfully', product);
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return errorResponse(res, 'Product not found', 404);

    return successResponse(res, 'Product deleted successfully', null, 200);
  } catch (error) {
    next(error);
  }
};

export const patchProductStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) return errorResponse(res, 'Product not found', 404);

    product.isActive = typeof isActive === 'boolean' ? isActive : product.isActive;
    await product.save();

    return successResponse(res, 'Product status updated successfully', product);
  } catch (error) {
    next(error);
  }
};
