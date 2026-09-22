/**
 * @openapi
 * /api/contact:
 *   post:
 *     summary: Submit contact enquiry
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Contact enquiry submitted
 *   get:
 *     summary: Get all contact enquiries
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Enquiries returned
 */
/**
 * @openapi
 * /api/contact/{id}:
 *   patch:
 *     summary: Update enquiry status
 *     tags: [Contact]
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
 *         description: Enquiry status updated
 */

import express from 'express';
import { createContact, getContacts, updateContactStatus } from '../controllers/contactController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', createContact);
router.get('/', protect, authorize('admin'), getContacts);
router.patch('/:id', protect, authorize('admin'), updateContactStatus);
router.patch('/:id/status', protect, authorize('admin'), updateContactStatus);

export default router;
