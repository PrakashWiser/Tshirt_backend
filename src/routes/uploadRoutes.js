/**
 * @openapi
 * /api/upload:
 *   post:
 *     summary: Upload product image
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 */

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { successResponse, errorResponse } from "../utils/response.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "../../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

router.post("/", (req, res) => {
  if (!req.files || !req.files.file) {
    return errorResponse(res, "No file uploaded", 400);
  }

  const file = req.files.file;

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];

  const fileType = file.mimetype || "";

  if (!allowedTypes.includes(fileType)) {
    return errorResponse(
      res,
      "Only JPG, JPEG, and PNG images are allowed",
      400,
    );
  }

  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
  const uploadPath = path.join(uploadDir, fileName);

  file.mv(uploadPath, (err) => {
    if (err) {
      return errorResponse(res, "File upload failed", 500);
    }
    const fileUrl = `/uploads/${fileName}`;
    return successResponse(res, "Image uploaded successfully", {
      imageUrl: fileUrl,
    });
  });
});

export default router;
