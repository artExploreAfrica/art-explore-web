import { Router } from 'express';
import * as subCategoryController from '../controllers/subCategory.controller';
import { validate } from '../middleware/validate';
import { listSubCategoriesQuerySchema } from '../validators/subCategory.validator';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: SubCategories
 *   description: Public institution sub-category lookup
 */

/**
 * @swagger
 * /api/v1/subcategories:
 *   get:
 *     summary: Paginated list of institution sub-categories
 *     tags: [SubCategories]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [GALLERY, STUDIO, CULTURAL_SPACE] }
 *     responses:
 *       200:
 *         description: A paginated list of sub-categories
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400: { description: Invalid query parameters }
 */
router.get(
  '/',
  validate({ query: listSubCategoriesQuerySchema }),
  subCategoryController.list,
);

export default router;
