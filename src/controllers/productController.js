import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { successResponse, errorResponse } from "../utils/response.js";

const deleteFileFromStorage = async (url) => {
  if (!url) return;
  if (url.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), url);
    try {
      await fs.unlink(filePath);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
};

const clean = (v) =>
  String(v || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const generateSku = (productName, color, size, existingSkus = []) => {
  const namePart = clean(productName).split("-").slice(0, 2).join("-") || "PRD";
  const colorPart = clean(color).replace(/-/g, "").slice(0, 4) || "CLR";
  const sizePart = clean(size).replace(/-/g, "").slice(0, 4) || "SZ";

  const base = `${namePart}-${colorPart}-${sizePart}`;

  if (!existingSkus.length) return base;

  let sku = base;
  let counter = 1;
  while (existingSkus.includes(sku)) {
    sku = `${base}-${counter}`;
    counter += 1;
  }
  return sku;
};

const collectUsedSkus = async (excludeProductId = null) => {
  const query = {};
  if (excludeProductId) {
    query._id = { $ne: excludeProductId };
  }
  const docs = await Product.find(query).select("variants.sku");
  const set = new Set();
  docs.forEach((doc) => {
    (doc.variants || []).forEach((v) => {
      if (v.sku) set.add(String(v.sku).toUpperCase());
    });
  });
  return set;
};

const fillMissingSkus = async (name, variants, excludeProductId = null) => {
  const used = await collectUsedSkus(excludeProductId);
  const localUsed = new Set();

  return variants.map((v) => {
    const existing = String(v.sku || "")
      .trim()
      .toUpperCase();

    if (existing) {
      used.add(existing);
      localUsed.add(existing);
      return { ...v, sku: existing };
    }

    const sku = generateSku(name, v.color, v.size, [...used, ...localUsed]);

    used.add(sku);
    localUsed.add(sku);

    return { ...v, sku };
  });
};

const normalizeVariants = (variants = []) => {
  return variants.map((variant) => ({
    ...(variant._id ? { _id: variant._id } : {}),
    color: String(variant.color || "").trim(),
    size: String(variant.size || "").trim(),
    price: Number(variant.price || 0),
    salePrice: Number(variant.salePrice || 0),
    sku: String(variant.sku || "")
      .trim()
      .toUpperCase(),
    stock: Number(variant.stock || 0),
    images: Array.isArray(variant.images)
      ? variant.images.filter(Boolean).map(String)
      : variant.image
        ? [String(variant.image)]
        : [],
    isActive: typeof variant.isActive === "boolean" ? variant.isActive : true,
  }));
};

const validateVariants = (variants) => {
  if (!Array.isArray(variants) || variants.length === 0) {
    return "At least one product variant is required";
  }
  const skuSet = new Set();
  const combinationSet = new Set();
  for (const variant of variants) {
    if (!variant.color) return "Variant color is required";
    if (!variant.size) return "Variant size is required";
    if (!variant.sku) return "Variant SKU is required";
    if (variant.price < 0) return "Variant price cannot be negative";
    if (variant.salePrice < 0) return "Variant sale price cannot be negative";
    if (variant.salePrice > variant.price && variant.salePrice !== 0) {
      return `Sale price cannot be greater than price for SKU ${variant.sku}`;
    }
    if (variant.stock < 0) return "Variant stock cannot be negative";
    if (skuSet.has(variant.sku)) {
      return `Duplicate SKU found: ${variant.sku}`;
    }
    skuSet.add(variant.sku);
    const combination = `${variant.color.toLowerCase()}::${variant.size.toLowerCase()}`;
    if (combinationSet.has(combination)) {
      return `Duplicate variant combination: ${variant.color} / ${variant.size}`;
    }
    combinationSet.add(combination);
  }
  return null;
};

const checkExistingSku = async (variants, productId = null) => {
  const skus = variants.map((variant) => variant.sku);
  const query = { "variants.sku": { $in: skus } };

  if (productId) {
    query._id = { $ne: productId };
  }

  const existingProduct =
    await Product.findOne(query).select("name variants.sku");

  if (!existingProduct) return null;

  const existingSku = existingProduct.variants.find((variant) =>
    skus.includes(variant.sku),
  );

  return existingSku?.sku || null;
};

const buildProductQuery = (query) => {
  const filter = { isActive: true };

  if (query.search) {
    const searchRegex = new RegExp(query.search, "i");
    filter.$or = [
      { name: searchRegex },
      { description: searchRegex },
      { "variants.sku": searchRegex },
    ];
  }

  if (query.category) filter.category = query.category;
  if (query.size) filter["variants.size"] = query.size;
  if (query.color) filter["variants.color"] = query.color;

  if (query.minPrice || query.maxPrice) {
    const priceFilter = {};
    if (query.minPrice) priceFilter.$gte = Number(query.minPrice);
    if (query.maxPrice) priceFilter.$lte = Number(query.maxPrice);
    filter.variants = { $elemMatch: { price: priceFilter } };
  }

  if (query.bestSeller === "true") filter.isBestSeller = true;
  if (query.newArrival === "true") filter.isNewArrival = true;
  if (query.featured === "true") filter.isFeatured = true;
  if (query.trending === "true") filter.isTrending = true;

  return filter;
};

export const getProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      sort = "createdAt",
      order = "desc",
    } = req.query;

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);

    const query = buildProductQuery(req.query);
    const sortOrder = order === "asc" ? 1 : -1;

    let sortField = "createdAt";
    if (sort === "rating") sortField = "rating";

    const baseQuery = Product.find(query)
      .populate("category", "name slug")
      .skip((currentPage - 1) * currentLimit)
      .limit(currentLimit);

    if (sort === "price") {
      baseQuery.sort({ "variants.price": sortOrder });
    } else {
      baseQuery.sort({ [sortField]: sortOrder });
    }

    const [products, total] = await Promise.all([
      baseQuery,
      Product.countDocuments(query),
    ]);

    return successResponse(res, "Products fetched successfully", {
      products,
      pagination: {
        page: currentPage,
        limit: currentLimit,
        total,
        pages: Math.ceil(total / currentLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProductBySlug = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      slug: req.params.slug,
      isActive: true,
    }).populate("category", "name slug");

    if (!product) {
      return errorResponse(res, "Product not found", 404);
    }

    return successResponse(res, "Product fetched successfully", product);
  } catch (error) {
    next(error);
  }
};

export const getTrendingProducts = async (req, res, next) => {
  try {
    const { limit = 8 } = req.query;

    const products = await Product.find({
      isActive: true,
      isTrending: true,
    })
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    return successResponse(
      res,
      "Trending products fetched successfully",
      products,
    );
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      slug,
      description,
      category,
      images = [],
      variants = [],
      rating = 0,
      reviewCount = 0,
      isFeatured = false,
      isBestSeller = false,
      isNewArrival = false,
      isTrending = false,
      isActive = true,
    } = req.body;

    if (!name?.trim()) {
      return errorResponse(res, "Product name is required", 400);
    }

    if (!slug?.trim()) {
      return errorResponse(res, "Product slug is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return errorResponse(res, "Invalid category", 400);
    }

    const categoryExists = await Category.findById(category);

    if (!categoryExists) {
      return errorResponse(res, "Invalid category", 400);
    }

    let normalizedVariants = normalizeVariants(variants);
    normalizedVariants = await fillMissingSkus(name.trim(), normalizedVariants);

    const variantError = validateVariants(normalizedVariants);

    if (variantError) {
      return errorResponse(res, variantError, 400);
    }

    const existingSku = await checkExistingSku(normalizedVariants);

    if (existingSku) {
      return errorResponse(res, `SKU already exists: ${existingSku}`, 409);
    }

    const product = await Product.create({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description: description || "",
      category,
      images: Array.isArray(images) ? images.filter(Boolean) : [],
      variants: normalizedVariants,
      rating: Number(rating || 0),
      reviewCount: Number(reviewCount || 0),
      isFeatured: Boolean(isFeatured),
      isBestSeller: Boolean(isBestSeller),
      isNewArrival: Boolean(isNewArrival),
      isTrending: Boolean(isTrending),
      isActive: Boolean(isActive),
    });

    return successResponse(res, "Product created successfully", product, 201);
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];
      if (duplicateField === "slug") {
        return errorResponse(res, "Product slug already exists", 409);
      }
      return errorResponse(res, "Duplicate product data", 409);
    }
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return errorResponse(res, "Invalid product ID", 400);
    }
    const product = await Product.findById(productId);
    if (!product) {
      return errorResponse(res, "Product not found", 404);
    }

    if (req.body.category) {
      if (!mongoose.Types.ObjectId.isValid(req.body.category)) {
        return errorResponse(res, "Invalid category", 400);
      }
      const categoryExists = await Category.findById(req.body.category);
      if (!categoryExists) {
        return errorResponse(res, "Invalid category", 400);
      }
    }

    if (req.body.variants) {
      let normalizedVariants = normalizeVariants(req.body.variants);

      const nameForSku = String(req.body.name || product.name || "").trim();

      normalizedVariants = await fillMissingSkus(
        nameForSku,
        normalizedVariants,
        productId,
      );

      const variantError = validateVariants(normalizedVariants);
      if (variantError) {
        return errorResponse(res, variantError, 400);
      }

      const existingSku = await checkExistingSku(normalizedVariants, productId);
      if (existingSku) {
        return errorResponse(res, `SKU already exists: ${existingSku}`, 409);
      }
      req.body.variants = normalizedVariants;
    }

    if (req.body.name !== undefined) {
      req.body.name = req.body.name.trim();
    }

    if (req.body.slug !== undefined) {
      req.body.slug = req.body.slug.trim().toLowerCase();
    }

    if (req.body.images !== undefined) {
      req.body.images = Array.isArray(req.body.images)
        ? req.body.images.filter(Boolean)
        : [];
    }

    const removedImages = Array.isArray(req.body.removedImages)
      ? req.body.removedImages
      : [];

    Object.assign(product, req.body);
    delete product.removedImages;
    await product.save();

    for (const url of removedImages) {
      try {
        await deleteFileFromStorage(url);
      } catch (e) {
        console.warn("Failed to delete file:", url, e?.message);
      }
    }

    return successResponse(res, "Product updated successfully", product);
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];
      if (duplicateField === "slug") {
        return errorResponse(res, "Product slug already exists", 409);
      }
      return errorResponse(res, "Duplicate product data", 409);
    }
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, "Invalid product ID", 400);
    }
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return errorResponse(res, "Product not found", 404);
    }
    return successResponse(res, "Product deleted successfully", null, 200);
  } catch (error) {
    next(error);
  }
};

export const patchProductStatus = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, "Invalid product ID", 400);
    }
    const { isActive } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) {
      return errorResponse(res, "Product not found", 404);
    }
    if (typeof isActive !== "boolean") {
      return errorResponse(res, "isActive must be boolean", 400);
    }
    product.isActive = isActive;
    await product.save();
    return successResponse(res, "Product status updated successfully", product);
  } catch (error) {
    next(error);
  }
};
