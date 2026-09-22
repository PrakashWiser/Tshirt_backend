/**
 * @openapi
 * /api/admin/customers:
 *   get:
 *     summary: Get all customers
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customers list returned
 */
/**
 * @openapi
 * /api/admin/customers/{id}/status:
 *   patch:
 *     summary: Update customer status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer status updated
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { getCustomers, getDashboardStats, getAdminNotifications, updateCustomerStatus } from '../controllers/adminController.js';
import { getCurrentUser, updateCurrentUserProfile, updateCurrentUserProfilePhoto, changeCurrentUserPassword } from '../controllers/authController.js';
import { getContacts } from '../controllers/contactController.js';
import {
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  updateCouponStatus,
} from '../controllers/couponController.js';

const router = express.Router();
router.use(protect, authorize('admin'));
router.get('/stats', getDashboardStats);
router.get('/notifications', getAdminNotifications);
router.get('/profile', getCurrentUser);
router.put('/profile', updateCurrentUserProfile);
router.put('/profile-photo', updateCurrentUserProfilePhoto);
router.put('/change-password', changeCurrentUserPassword);
router.get('/customers', getCustomers);
router.get('/users', getCustomers);
router.get('/enquiries', getContacts);
router.get('/coupons', getAllCoupons);
router.get('/coupons/:id', getCouponById);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.patch('/coupons/:id/status', updateCouponStatus);
router.delete('/coupons/:id', deleteCoupon);
router.patch('/customers/:id/status', updateCustomerStatus);

export default router;
