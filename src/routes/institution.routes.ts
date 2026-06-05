import { Router } from 'express';
import * as institutionController from '../controllers/institution.controller';
import { validate } from '../middleware/validate';
import {
  idParamSchema,
  listInstitutionsQuerySchema,
} from '../validators/institution.validator';

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
 *         schema: { type: string, enum: [GALLERY, STUDIO, CULTURAL_SPACE] }
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

export default router;
