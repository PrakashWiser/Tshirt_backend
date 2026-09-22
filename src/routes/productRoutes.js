/**
 * @openapi
 * /api/products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Product list returned
 *   post:
 *     summary: Create a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Product created
 */
/**
 * @openapi
 * /api/products/{slug}:
 *   get:
 *     summary: Get product by slug
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product returned
 */

import express from 'express';
import { getProducts, getProductBySlug, getTrendingProducts, createProduct, updateProduct, deleteProduct, patchProductStatus } from '../controllers/productController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/trending', getTrendingProducts);
router.get('/', getProducts);
router.get('/:slug', getProductBySlug);
router.post('/', protect, authorize('admin'), createProduct);
router.put('/:id', protect, authorize('admin'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);
router.patch('/:id/status', protect, authorize('admin'), patchProductStatus);

export default router;
