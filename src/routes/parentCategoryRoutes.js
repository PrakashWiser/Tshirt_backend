import express from "express";
import {
  createParentCategory,
  deleteParentCategory,
  getParentCategories,
  getPublicParentCategories,
  updateParentCategory,
} from "../controllers/parentCategoryController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @openapi
 * /api/parent-categories/public:
 *   get:
 *     summary: Get active parent categories for storefronts
 *     tags: [Categories]
 *     security: []
 *     responses:
 *       200:
 *         description: Active parent categories returned
 */
router.get("/public", getPublicParentCategories);

router.use(protect, authorize("admin"));
router.get("/", getParentCategories);
router.post("/", createParentCategory);
router.put("/:id", updateParentCategory);
router.delete("/:id", deleteParentCategory);

export default router;
