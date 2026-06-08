import { Role } from '@prisma/client';
import { Router } from 'express';
import * as submissionController from '../controllers/submission.controller';
import { authenticate } from '../middleware/authenticate';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import {
  mySubmissionsQuerySchema,
  submitInstitutionSchema,
} from '../validators/submission.validator';

const router = Router();

// All submission routes require an authenticated USER.
router.use(authenticate, roleGuard(Role.USER));

/**
 * @swagger
 * tags:
 *   name: Submissions
 *   description: USER-submitted institutions (pending admin review)
 */

/**
 * @swagger
 * /api/v1/submissions:
 *   post:
 *     summary: Submit a new institution for review (USER only)
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/InstitutionInput' }
 *     responses:
 *       201: { description: Submission received (PENDING) }
 *       400: { description: Validation error }
 *       401: { description: Unauthenticated }
 *       403: { description: Not a USER }
 */
router.post(
  '/',
  validate({ body: submitInstitutionSchema }),
  submissionController.submit,
);

/**
 * @swagger
 * /api/v1/submissions/mine:
 *   get:
 *     summary: List the authenticated USER's own submissions
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: The USER's submissions }
 *       401: { description: Unauthenticated }
 *       403: { description: Not a USER }
 */
router.get(
  '/mine',
  validate({ query: mySubmissionsQuerySchema }),
  submissionController.mine,
);

export default router;
