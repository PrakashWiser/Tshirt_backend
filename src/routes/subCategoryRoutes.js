import express from "express";
import {
  createSubCategory,
  deleteSubCategory,
  getSubCategories,
  updateSubCategory,
} from "../controllers/subCategoryController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, authorize("admin"));
router.get("/", getSubCategories);
router.post("/", createSubCategory);
router.put("/:id", updateSubCategory);
router.delete("/:id", deleteSubCategory);

export default router;
