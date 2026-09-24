import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { successResponse, errorResponse } from "../utils/response.js";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../utils/cloudinaryUpload.js";

import {
  fillMissingSkus,
  normalizeVariants,
  validateVariants,
  checkExistingSku,
} from "../utils/productUtils.js";

const buildProductQuery = (query) => {
  const filter = {
    isActive: true,
  };

  if (query.search) {
    const searchRegex = new RegExp(query.search, "i");

    filter.$or = [
      {
        name: searchRegex,
      },
      {
        description: searchRegex,
      },
      {
        "variants.sku": searchRegex,
      },
    ];
  }

  if (query.category) {
    filter.category = query.category;
  }

  if (query.size) {
    filter["variants.size"] = query.size;
  }

  if (query.color) {
    filter["variants.color"] = query.color;
  }

  if (query.minPrice || query.maxPrice) {
    const priceFilter = {};

    if (query.minPrice) {
      priceFilter.$gte = Number(query.minPrice);
    }

    if (query.maxPrice) {
      priceFilter.$lte = Number(query.maxPrice);
    }

    filter.variants = {
      $elemMatch: {
        price: priceFilter,
      },
    };
  }

  if (query.bestSeller === "true") {
    filter.isBestSeller = true;
  }

  if (query.newArrival === "true") {
    filter.isNewArrival = true;
  }

  if (query.featured === "true") {
    filter.isFeatured = true;
  }

  if (query.trending === "true") {
    filter.isTrending = true;
  }

  return filter;
};

const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const toArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const extractVariantImageFiles = (files) => {
  const map = {};

  if (!files) return map;

  for (const key of Object.keys(files)) {
    const match = /^variantImages\[(\d+)\]$/.exec(key);

    if (!match) continue;

    const index = Number(match[1]);

    map[index] = toArray(files[key]);
  }

  return map;
};

const cleanupUploadedVariantImages = async (uploadedVariantImages) => {
  for (const list of Object.values(uploadedVariantImages)) {
    for (const image of list) {
      await deleteImageFromCloudinary(image.publicId);
    }
  }
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

    if (sort === "rating") {
      sortField = "rating";
    }

    const baseQuery = Product.find(query)
      .populate("category", "name slug")
      .skip((currentPage - 1) * currentLimit)
      .limit(currentLimit);

    if (sort === "price") {
      baseQuery.sort({
        "variants.price": sortOrder,
      });
    } else {
      baseQuery.sort({
        [sortField]: sortOrder,
      });
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
      .sort({
        createdAt: -1,
      })
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
  const uploadedVariantImages = {};

  try {
    const {
      name,
      slug,
      description,
      category,
      rating = 0,
      reviewCount = 0,
      isFeatured = false,
      isBestSeller = false,
      isNewArrival = false,
      isTrending = false,
      isActive = true,
    } = req.body;

    const variants = parseJsonField(req.body.variants, []);

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

    const variantImageFiles = extractVariantImageFiles(req.files);

    for (const [indexStr, files] of Object.entries(variantImageFiles)) {
      const index = Number(indexStr);
      uploadedVariantImages[index] = [];

      for (const file of files) {
        const uploaded = await uploadImageToCloudinary(file, "tshirt-variants");
        uploadedVariantImages[index].push(uploaded);
      }
    }

    let normalizedVariants = normalizeVariants(variants);

    normalizedVariants = normalizedVariants.map((variant, index) => {
      const newUrls = (uploadedVariantImages[index] || []).map(
        (image) => image.url,
      );

      return {
        ...variant,
        images: [...(variant.images || []), ...newUrls],
      };
    });

    normalizedVariants = await fillMissingSkus(name.trim(), normalizedVariants);

    const variantError = validateVariants(normalizedVariants);

    if (variantError) {
      await cleanupUploadedVariantImages(uploadedVariantImages);
      return errorResponse(res, variantError, 400);
    }

    const existingSku = await checkExistingSku(normalizedVariants);

    if (existingSku) {
      await cleanupUploadedVariantImages(uploadedVariantImages);
      return errorResponse(res, `SKU already exists: ${existingSku}`, 409);
    }

    const product = await Product.create({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description: description || "",
      category,
      images: [],
      variants: normalizedVariants,
      rating: Number(rating || 0),
      reviewCount: Number(reviewCount || 0),
      isFeatured: isFeatured === true || isFeatured === "true",
      isBestSeller: isBestSeller === true || isBestSeller === "true",
      isNewArrival: isNewArrival === true || isNewArrival === "true",
      isTrending: isTrending === true || isTrending === "true",
      isActive: isActive === true || isActive === "true",
    });

    return successResponse(res, "Product created successfully", product, 201);
  } catch (error) {
    await cleanupUploadedVariantImages(uploadedVariantImages);

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
  const newUploadedVariantImages = {};

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

    const variantImageFiles = extractVariantImageFiles(req.files);

    for (const [indexStr, files] of Object.entries(variantImageFiles)) {
      const index = Number(indexStr);
      newUploadedVariantImages[index] = [];

      for (const file of files) {
        const uploaded = await uploadImageToCloudinary(file, "tshirt-variants");
        newUploadedVariantImages[index].push(uploaded);
      }
    }

    const variants = parseJsonField(req.body.variants, undefined);

    if (variants !== undefined) {
      let normalizedVariants = normalizeVariants(variants);

      normalizedVariants = normalizedVariants.map((variant, index) => {
        const newUrls = (newUploadedVariantImages[index] || []).map(
          (image) => image.url,
        );

        return {
          ...variant,
          images: [...(variant.images || []), ...newUrls],
        };
      });

      const nameForSku = String(req.body.name || product.name || "").trim();

      normalizedVariants = await fillMissingSkus(
        nameForSku,
        normalizedVariants,
        productId,
      );

      const variantError = validateVariants(normalizedVariants);

      if (variantError) {
        await cleanupUploadedVariantImages(newUploadedVariantImages);
        return errorResponse(res, variantError, 400);
      }

      const existingSku = await checkExistingSku(normalizedVariants, productId);

      if (existingSku) {
        await cleanupUploadedVariantImages(newUploadedVariantImages);
        return errorResponse(res, `SKU already exists: ${existingSku}`, 409);
      }

      req.body.variants = normalizedVariants;
    } else if (Object.keys(newUploadedVariantImages).length > 0) {
      const existingVariants = (product.variants || []).map(
        (variant, index) => {
          const base =
            typeof variant.toObject === "function"
              ? variant.toObject()
              : variant;

          const newUrls = (newUploadedVariantImages[index] || []).map(
            (image) => image.url,
          );

          return {
            ...base,
            images: [...(base.images || []), ...newUrls],
          };
        },
      );

      req.body.variants = existingVariants;
    }

    if (req.body.name !== undefined) {
      req.body.name = req.body.name.trim();
    }

    if (req.body.slug !== undefined) {
      req.body.slug = req.body.slug.trim().toLowerCase();
    }

    delete req.body.images;

    const removedImages = parseJsonField(req.body.removedImages, []);

    Object.assign(product, req.body);

    delete product.removedImages;

    await product.save();

    for (const url of removedImages) {
      const image = String(url || "");

      if (image.includes("res.cloudinary.com")) {
        const parts = image.split("/upload/")[1];

        if (parts) {
          const publicId = parts
            .replace(/^v\d+\//, "")
            .replace(/\.[^/.]+$/, "");

          await deleteImageFromCloudinary(publicId);
        }
      }
    }

    return successResponse(res, "Product updated successfully", product);
  } catch (error) {
    await cleanupUploadedVariantImages(newUploadedVariantImages);

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

    const product = await Product.findById(req.params.id);

    if (!product) {
      return errorResponse(res, "Product not found", 404);
    }

    await Product.findByIdAndDelete(req.params.id);

    for (const variant of product.variants || []) {
      for (const url of variant.images || []) {
        const image = String(url || "");

        if (image.includes("res.cloudinary.com")) {
          const parts = image.split("/upload/")[1];

          if (parts) {
            const publicId = parts
              .replace(/^v\d+\//, "")
              .replace(/\.[^/.]+$/, "");

            await deleteImageFromCloudinary(publicId);
          }
        }
      }
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
