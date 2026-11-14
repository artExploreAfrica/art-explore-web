import { Router } from 'express';
import * as enquiryController from '../controllers/enquiry.controller';
import { enquiryLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { createEnquirySchema } from '../validators/enquiry.validator';

const router = Router();

/**
 * @swagger
 * /api/v1/enquiries:
 *   post:
 *     summary: Send a message to the team without an account
 *     description: >
 *       Used by "Reach out" and "Learn more" in the home-page contribute form.
 *       Stored as NEW for the admin Enquiries inbox; never shown publicly.
 *       `company` is a honeypot and must be left empty. Rate limited per IP.
 *     tags: [Enquiries]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [intent, name, email, message]
 *             properties:
 *               intent: { type: string, enum: [REACH_OUT, LEARN_MORE] }
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               organisation: { type: string }
 *               message: { type: string }
 *     responses:
 *       201: { description: Message received }
 *       400: { description: Validation failed }
 *       429: { description: Too many messages from this connection }
 */
router.post('/', enquiryLimiter, validate({ body: createEnquirySchema }), enquiryController.create);

export default router;
