import { Router } from 'express';
import * as tagController from '../controllers/tag.controller';
import { validate } from '../middleware/validate';
import { listTagsQuerySchema } from '../validators/tag.validator';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Tags
 *   description: Public tag lookup
 */

/**
 * @swagger
 * /api/v1/tags:
 *   get:
 *     summary: Paginated list of tags
 *     tags: [Tags]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Case-insensitive name search
 *     responses:
 *       200:
 *         description: A paginated list of tags
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400: { description: Invalid query parameters }
 */
router.get('/', validate({ query: listTagsQuerySchema }), tagController.list);

export default router;
