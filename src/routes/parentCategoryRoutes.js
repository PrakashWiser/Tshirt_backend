import express from "express";
import {
  createParentCategory,
  deleteParentCategory,
  getParentCategories,
  updateParentCategory,
} from "../controllers/parentCategoryController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, authorize("admin"));
router.get("/", getParentCategories);
router.post("/", createParentCategory);
router.put("/:id", updateParentCategory);
router.delete("/:id", deleteParentCategory);

export default router;
