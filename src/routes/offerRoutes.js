import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createOffer,
  deleteOffer,
  getAllOffers,
  getOfferById,
  updateOffer,
  updateOfferStatus,
} from '../controllers/offerController.js';

const router = express.Router();

router.use(protect);
router.get('/', getAllOffers);
router.get('/:id', getOfferById);
router.post('/', createOffer);
router.put('/:id', updateOffer);
router.patch('/:id/status', updateOfferStatus);
router.delete('/:id', deleteOffer);

export default router;
