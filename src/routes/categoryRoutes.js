/**
 * @openapi
 * /api/categories:
 *   get:
 *     summary: Get product categories (Sub Categories)
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Categories list returned
 */
/**
 * @openapi
 * /api/categories/{slug}:
 *   get:
 *     summary: Get category by slug
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category returned
 */
import express from 'express';
import {
  getCategories,
  getCategoryBySlug,
} from '../controllers/categoryReadController.js';

const router = express.Router();

router.get('/', getCategories);
router.get('/:slug', getCategoryBySlug);

export default router;
