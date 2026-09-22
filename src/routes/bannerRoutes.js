import express from 'express';
import {
  getActiveBanners,
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../controllers/bannerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getActiveBanners);
router.get('/all', protect, authorize('admin'), getAllBanners);
router.get('/:id', getBannerById);
router.post('/', protect, authorize('admin'), createBanner);
router.put('/:id', protect, authorize('admin'), updateBanner);
router.delete('/:id', protect, authorize('admin'), deleteBanner);

export default router;
