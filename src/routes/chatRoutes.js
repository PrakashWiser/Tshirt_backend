/**
 * @openapi
 * /api/chat:
 *   post:
 *     summary: Send a message to AI chatbot
 *     description: Sends a message to the AI chatbot and returns the generated response.
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: User message
 *                 example: Show me black t-shirts under 1000
 *     responses:
 *       200:
 *         description: Chat response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Chat response generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     reply:
 *                       type: string
 *                       example: Sure! Here are some black t-shirts under ₹1000.
 *       400:
 *         description: Message is required
 *       500:
 *         description: Failed to generate chat response
 */

import express from "express";
import { chat } from "../controllers/chatController.js";

const router = express.Router();

router.post("/", chat);

export default router;
