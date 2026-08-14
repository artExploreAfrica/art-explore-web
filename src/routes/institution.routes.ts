import { Role } from '@prisma/client';
import { Router } from 'express';
import * as institutionController from '../controllers/institution.controller';
import * as reviewController from '../controllers/review.controller';
import { authenticate } from '../middleware/authenticate';
import { contributorWriteLimiter } from '../middleware/rateLimiter';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { listExhibitionsQuerySchema } from '../validators/exhibition.validator';
import {
  idParamSchema,
  listInstitutionsQuerySchema,
} from '../validators/institution.validator';
import {
  createReviewSchema,
  listReviewsQuerySchema,
} from '../validators/review.validator';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Institutions
 *   description: Public gallery discovery endpoints
 */

/**
 * @swagger
 * /api/v1/institutions:
 *   get:
 *     summary: Paginated list of published institutions
 *     tags: [Institutions]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: area
 *         schema: { type: string, enum: [ISLAND, MAINLAND, OTHER] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [ART_GALLERY, MUSEUM, INSTITUTE, FOUNDATION, STUDIO, CULTURAL_SPACE] }
 *       - in: query
 *         name: subCategoryId
 *         schema: { type: string }
 *         description: Filter by sub-category id
 *       - in: query
 *         name: tag
 *         schema: { type: string }
 *         description: Tag id or slug (name)
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Free-text search over name, description, and tags
 *     responses:
 *       200:
 *         description: A paginated list of institutions
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400: { description: Invalid query parameters }
 */
router.get(
  '/',
  validate({ query: listInstitutionsQuerySchema }),
  institutionController.list,
);

/**
 * @swagger
 * /api/v1/institutions/map:
 *   get:
 *     summary: Lightweight institution list for map rendering
 *     tags: [Institutions]
 *     responses:
 *       200:
 *         description: Array of { id, name, lat, lng, type }
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.get('/map', institutionController.map);

/**
 * @swagger
 * /api/v1/institutions/{id}:
 *   get:
 *     summary: Single published institution by id
 *     tags: [Institutions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The institution
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404: { description: Not found }
 */
router.get('/:id', validate({ params: idParamSchema }), institutionController.detail);

/**
 * @swagger
 * /api/v1/institutions/{id}/exhibitions:
 *   get:
 *     summary: Exhibitions for a published institution
 *     description: >
 *       `scope` defaults to `live`, so this list agrees with the venue's
 *       `hasExhibition` flag. Pass `past` for the archive or `all` for both.
 *     tags: [Institutions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: scope
 *         schema: { type: string, enum: [live, past, all], default: live }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated exhibitions (most recent first)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404: { description: Not found }
 */
router.get(
  '/:id/exhibitions',
  validate({ params: idParamSchema, query: listExhibitionsQuerySchema }),
  institutionController.exhibitions,
);

/**
 * @swagger
 * /api/v1/institutions/{id}/reviews:
 *   get:
 *     summary: Approved reviews for a published institution
 *     tags: [Institutions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Paginated approved reviews, newest first }
 *       404: { description: Not found }
 *   post:
 *     summary: Review a venue (USER only)
 *     description: >
 *       Created PENDING — it is neither public nor counted in the venue's
 *       average until a moderator approves it. One review per venue per account;
 *       a second attempt returns 409.
 *     tags: [Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string, maxLength: 2000 }
 *     responses:
 *       201: { description: Review submitted and pending moderation }
 *       409: { description: You have already reviewed this venue }
 *       429: { description: Too many submissions — rate limited }
 */
router.get(
  '/:id/reviews',
  validate({ params: idParamSchema, query: listReviewsQuerySchema }),
  reviewController.listForInstitution,
);

router.post(
  '/:id/reviews',
  authenticate,
  roleGuard(Role.USER),
  contributorWriteLimiter,
  validate({ params: idParamSchema, body: createReviewSchema }),
  reviewController.create,
);

export default router;
