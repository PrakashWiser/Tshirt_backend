import cloudinary from "../config/cloudinary.js";
import { ALLOWED_IMAGE_TYPES } from "./allowedFileTypes.js";

export const uploadImageToCloudinary = async (
  file,
  folder = "tshirt-images",
) => {
  if (!file) {
    throw new Error("Image is required");
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new Error("Only JPG, JPEG, PNG and WEBP images are allowed");
  }
  const result = await cloudinary.uploader.upload(file.tempFilePath, {
    folder,
    resource_type: "image",
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

export const deleteImageFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });
  } catch (error) {
    console.error("Cloudinary delete error:", error);
  }
};
