import Product from "../models/Product.js";

export const clean = (v) =>
  String(v || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const generateSku = (productName, color, size, existingSkus = []) => {
  const namePart = clean(productName).split("-").slice(0, 2).join("-") || "PRD";
  const colorPart = clean(color).replace(/-/g, "").slice(0, 4) || "CLR";
  const sizePart = clean(size).replace(/-/g, "").slice(0, 4) || "SZ";
  const base = `${namePart}-${colorPart}-${sizePart}`;

  if (!existingSkus.length) {
    return base;
  }

  let sku = base;
  let counter = 1;

  while (existingSkus.includes(sku)) {
    sku = `${base}-${counter}`;
    counter += 1;
  }

  return sku;
};

export const collectUsedSkus = async (excludeProductId = null) => {
  const query = {};

  if (excludeProductId) {
    query._id = {
      $ne: excludeProductId,
    };
  }

  const docs = await Product.find(query).select("variants.sku");

  const set = new Set();

  docs.forEach((doc) => {
    (doc.variants || []).forEach((v) => {
      if (v.sku) {
        set.add(String(v.sku).toUpperCase());
      }
    });
  });

  return set;
};

export const fillMissingSkus = async (
  name,
  variants,
  excludeProductId = null,
) => {
  const used = await collectUsedSkus(excludeProductId);

  const localUsed = new Set();

  return variants.map((v) => {
    const existing = String(v.sku || "")
      .trim()
      .toUpperCase();

    if (existing) {
      used.add(existing);
      localUsed.add(existing);

      return {
        ...v,
        sku: existing,
      };
    }

    const sku = generateSku(name, v.color, v.size, [...used, ...localUsed]);

    used.add(sku);
    localUsed.add(sku);

    return {
      ...v,
      sku,
    };
  });
};

export const normalizeVariants = (variants = []) => {
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

export const validateVariants = (variants) => {
  if (!Array.isArray(variants) || variants.length === 0) {
    return "At least one product variant is required";
  }

  const skuSet = new Set();
  const combinationSet = new Set();

  for (const variant of variants) {
    if (!variant.color) {
      return "Variant color is required";
    }

    if (!variant.size) {
      return "Variant size is required";
    }

    if (!variant.sku) {
      return "Variant SKU is required";
    }

    if (variant.price < 0) {
      return "Variant price cannot be negative";
    }

    if (variant.salePrice < 0) {
      return "Variant sale price cannot be negative";
    }

    if (variant.salePrice > variant.price && variant.salePrice !== 0) {
      return `Sale price cannot be greater than price for SKU ${variant.sku}`;
    }

    if (variant.stock < 0) {
      return "Variant stock cannot be negative";
    }

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

export const checkExistingSku = async (variants, productId = null) => {
  const skus = variants.map((variant) => variant.sku);

  const query = {
    "variants.sku": {
      $in: skus,
    },
  };

  if (productId) {
    query._id = {
      $ne: productId,
    };
  }

  const existingProduct =
    await Product.findOne(query).select("name variants.sku");

  if (!existingProduct) {
    return null;
  }
  const existingSku = existingProduct.variants.find((variant) =>
    skus.includes(variant.sku),
  );

  return existingSku?.sku || null;
};
