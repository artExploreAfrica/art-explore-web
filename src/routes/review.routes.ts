import { Role } from '@prisma/client';
import { Router } from 'express';
import * as reviewController from '../controllers/review.controller';
import { authenticate } from '../middleware/authenticate';
import { contributorWriteLimiter } from '../middleware/rateLimiter';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import {
  reviewIdParamSchema,
  updateReviewSchema,
} from '../validators/review.validator';

const router = Router();

// Editing and deleting a review is always the author acting on their own row;
// ownership itself is enforced in the service.
router.use(authenticate, roleGuard(Role.USER));

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Contributor reviews of venues
 */

/**
 * @swagger
 * /api/v1/reviews/{id}:
 *   put:
 *     summary: Edit your own review
 *     description: >
 *       Any edit returns the review to PENDING and removes it from the venue's
 *       average until a moderator approves it again.
 *     tags: [Reviews]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Review updated and pending moderation }
 *       404: { description: No such review belonging to you }
 *   delete:
 *     summary: Delete your own review
 *     tags: [Reviews]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Review deleted }
 *       404: { description: No such review belonging to you }
 */
router.put(
  '/:id',
  contributorWriteLimiter,
  validate({ params: reviewIdParamSchema, body: updateReviewSchema }),
  reviewController.update,
);

router.delete(
  '/:id',
  validate({ params: reviewIdParamSchema }),
  reviewController.remove,
);

export default router;
