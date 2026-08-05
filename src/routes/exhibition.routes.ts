import { Router } from 'express';
import * as institutionController from '../controllers/institution.controller';
import { validate } from '../middleware/validate';
import { listPublicExhibitionsQuerySchema } from '../validators/exhibition.validator';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Exhibitions
 *   description: Public cross-venue exhibition discovery
 */

/**
 * @swagger
 * /api/v1/exhibitions:
 *   get:
 *     summary: What's on across every venue
 *     description: >
 *       Approved, active exhibitions at published venues, soonest to finish
 *       first. `scope` defaults to `live` (not yet ended); pass `past` for the
 *       archive or `all` for both.
 *     tags: [Exhibitions]
 *     parameters:
 *       - in: query
 *         name: scope
 *         schema: { type: string, enum: [live, past, all], default: live }
 *       - in: query
 *         name: area
 *         schema: { type: string, enum: [ISLAND, MAINLAND, OTHER] }
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [ART_GALLERY, MUSEUM, INSTITUTE, FOUNDATION, STUDIO, CULTURAL_SPACE]
 *       - in: query
 *         name: institutionId
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated exhibitions, each with a summary of its venue
 */
router.get(
  '/',
  validate({ query: listPublicExhibitionsQuerySchema }),
  institutionController.publicExhibitions,
);

export default router;
