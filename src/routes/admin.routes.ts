import { Role } from '@prisma/client';
import { Router } from 'express';
import * as adminExhibitionController from '../controllers/adminExhibition.controller';
import * as adminInstitutionController from '../controllers/adminInstitution.controller';
import * as adminSubCategoryController from '../controllers/adminSubCategory.controller';
import * as adminTagController from '../controllers/adminTag.controller';
import * as auditController from '../controllers/audit.controller';
import * as dashboardController from '../controllers/dashboard.controller';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/authenticate';
import { roleGuard } from '../middleware/roleGuard';
import { uploadImage } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  createInstitutionSchema,
  idParamSchema,
  updateInstitutionSchema,
} from '../validators/institution.validator';
import {
  createExhibitionSchema,
  exhibitionParamsSchema,
  updateExhibitionSchema,
} from '../validators/exhibition.validator';
import {
  createSubCategorySchema,
  listSubCategoriesQuerySchema,
  updateSubCategorySchema,
} from '../validators/subCategory.validator';
import {
  createTagSchema,
  listTagsQuerySchema,
  updateTagSchema,
} from '../validators/tag.validator';
import {
  listSubmissionsQuerySchema,
  rejectSchema,
} from '../validators/submission.validator';
import { auditLogQuerySchema } from '../validators/audit.validator';
import {
  createUserSchema,
  paginationQuerySchema,
} from '../validators/user.validator';

const isAdmin = roleGuard(Role.SUPER_ADMIN, Role.ADMIN);

const router = Router();

// Every admin route requires a valid access token.
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: Admin - Institutions
 *     description: Institution management (ADMIN or SUPER_ADMIN)
 *   - name: Admin - Users
 *     description: Admin account management (SUPER_ADMIN only)
 *   - name: Admin - Audit
 *     description: Audit trail (SUPER_ADMIN only)
 *   - name: Admin - Dashboard
 *     description: Aggregate counts
 */

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     summary: Aggregate counts (institutions total/published/drafts, admins)
 *     tags: [Admin - Dashboard]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Counts, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessResponse' } } } }
 *       401: { description: Unauthenticated }
 *       403: { description: Forbidden }
 */
router.get('/dashboard', roleGuard(Role.SUPER_ADMIN, Role.ADMIN), dashboardController.counts);

// ---------------------------------------------------------------------------
// Institution management (ADMIN or SUPER_ADMIN)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/admin/institutions:
 *   post:
 *     summary: Create a new institution
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/InstitutionInput' }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthenticated }
 *       403: { description: Forbidden }
 */
router.post(
  '/institutions',
  roleGuard(Role.SUPER_ADMIN, Role.ADMIN),
  validate({ body: createInstitutionSchema }),
  adminInstitutionController.create,
);

/**
 * @swagger
 * /api/v1/admin/institutions/{id}:
 *   put:
 *     summary: Update an institution
 *     tags: [Admin - Institutions]
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
 *           schema: { $ref: '#/components/schemas/InstitutionInput' }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Validation error }
 *       404: { description: Not found }
 */
router.put(
  '/institutions/:id',
  roleGuard(Role.SUPER_ADMIN, Role.ADMIN),
  validate({ params: idParamSchema, body: updateInstitutionSchema }),
  adminInstitutionController.update,
);

/**
 * @swagger
 * /api/v1/admin/institutions/{id}:
 *   delete:
 *     summary: Soft delete an institution (sets deletedAt; excluded from all reads)
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Soft deleted }
 *       404: { description: Not found }
 */
router.delete(
  '/institutions/:id',
  roleGuard(Role.SUPER_ADMIN, Role.ADMIN),
  validate({ params: idParamSchema }),
  adminInstitutionController.remove,
);

/**
 * @swagger
 * /api/v1/admin/institutions/{id}/publish:
 *   post:
 *     summary: Toggle the publish status of an institution
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Publish status toggled }
 *       404: { description: Not found }
 */
router.post(
  '/institutions/:id/publish',
  roleGuard(Role.SUPER_ADMIN, Role.ADMIN),
  validate({ params: idParamSchema }),
  adminInstitutionController.publish,
);

/**
 * @swagger
 * /api/v1/admin/institutions/{id}/images:
 *   post:
 *     summary: Upload an image to S3 and attach it to the institution
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image: { type: string, format: binary }
 *     responses:
 *       201: { description: Image uploaded and attached }
 *       400: { description: No/invalid file }
 *       404: { description: Not found }
 */
router.post(
  '/institutions/:id/images',
  roleGuard(Role.SUPER_ADMIN, Role.ADMIN),
  validate({ params: idParamSchema }),
  uploadImage,
  adminInstitutionController.uploadImageHandler,
);

// ---------------------------------------------------------------------------
// Exhibitions (nested under an institution; ADMIN or SUPER_ADMIN)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/admin/institutions/{id}/exhibitions:
 *   post:
 *     summary: Create an exhibition for an institution
 *     tags: [Admin - Institutions]
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
 *           schema: { $ref: '#/components/schemas/ExhibitionInput' }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       404: { description: Institution not found }
 */
router.post(
  '/institutions/:id/exhibitions',
  isAdmin,
  validate({ params: idParamSchema, body: createExhibitionSchema }),
  adminExhibitionController.create,
);

/**
 * @swagger
 * /api/v1/admin/institutions/{id}/exhibitions/{exhibitionId}:
 *   put:
 *     summary: Update an exhibition
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: exhibitionId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ExhibitionInput' }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.put(
  '/institutions/:id/exhibitions/:exhibitionId',
  isAdmin,
  validate({ params: exhibitionParamsSchema, body: updateExhibitionSchema }),
  adminExhibitionController.update,
);

/**
 * @swagger
 * /api/v1/admin/institutions/{id}/exhibitions/{exhibitionId}:
 *   delete:
 *     summary: Delete an exhibition
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: exhibitionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 */
router.delete(
  '/institutions/:id/exhibitions/:exhibitionId',
  isAdmin,
  validate({ params: exhibitionParamsSchema }),
  adminExhibitionController.remove,
);

/**
 * @swagger
 * /api/v1/admin/institutions/{id}/exhibitions/{exhibitionId}/image:
 *   post:
 *     summary: Upload and attach an image to an exhibition
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: exhibitionId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image: { type: string, format: binary }
 *     responses:
 *       201: { description: Image uploaded and attached }
 *       400: { description: No/invalid file }
 *       404: { description: Not found }
 */
router.post(
  '/institutions/:id/exhibitions/:exhibitionId/image',
  isAdmin,
  validate({ params: exhibitionParamsSchema }),
  uploadImage,
  adminExhibitionController.uploadImageHandler,
);

// ---------------------------------------------------------------------------
// Submission review (ADMIN or SUPER_ADMIN)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/admin/submissions:
 *   get:
 *     summary: List user-submitted institutions by status (default PENDING)
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PENDING, APPROVED, REJECTED], default: PENDING }
 *     responses:
 *       200: { description: Submissions }
 *       403: { description: Forbidden }
 */
router.get(
  '/submissions',
  isAdmin,
  validate({ query: listSubmissionsQuerySchema }),
  adminInstitutionController.listSubmissions,
);

/**
 * @swagger
 * /api/v1/admin/institutions/{id}/approve:
 *   post:
 *     summary: Approve a submitted institution
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Approved (publish separately to make it live) }
 *       404: { description: Not found }
 */
router.post(
  '/institutions/:id/approve',
  isAdmin,
  validate({ params: idParamSchema }),
  adminInstitutionController.approve,
);

/**
 * @swagger
 * /api/v1/admin/institutions/{id}/reject:
 *   post:
 *     summary: Reject a submitted institution with a review note
 *     tags: [Admin - Institutions]
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
 *             required: [reviewNote]
 *             properties:
 *               reviewNote: { type: string }
 *     responses:
 *       200: { description: Rejected }
 *       400: { description: Validation error }
 *       404: { description: Not found }
 */
router.post(
  '/institutions/:id/reject',
  isAdmin,
  validate({ params: idParamSchema, body: rejectSchema }),
  adminInstitutionController.reject,
);

// ---------------------------------------------------------------------------
// Sub-categories (ADMIN or SUPER_ADMIN)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/admin/subcategories:
 *   get:
 *     summary: List sub-categories
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [GALLERY, STUDIO, CULTURAL_SPACE] }
 *     responses:
 *       200: { description: Sub-categories }
 *   post:
 *     summary: Create a sub-category
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SubCategoryInput' }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Duplicate name for that type }
 */
router.get(
  '/subcategories',
  isAdmin,
  validate({ query: listSubCategoriesQuerySchema }),
  adminSubCategoryController.list,
);
router.post(
  '/subcategories',
  isAdmin,
  validate({ body: createSubCategorySchema }),
  adminSubCategoryController.create,
);

/**
 * @swagger
 * /api/v1/admin/subcategories/{id}:
 *   put:
 *     summary: Update a sub-category
 *     tags: [Admin - Institutions]
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
 *           schema: { $ref: '#/components/schemas/SubCategoryInput' }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 *   delete:
 *     summary: Delete a sub-category (blocked while institutions reference it)
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 *       409: { description: Still in use }
 */
router.put(
  '/subcategories/:id',
  isAdmin,
  validate({ params: idParamSchema, body: updateSubCategorySchema }),
  adminSubCategoryController.update,
);
router.delete(
  '/subcategories/:id',
  isAdmin,
  validate({ params: idParamSchema }),
  adminSubCategoryController.remove,
);

// ---------------------------------------------------------------------------
// Tags (ADMIN or SUPER_ADMIN)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/admin/tags:
 *   get:
 *     summary: List tags
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Tags }
 *   post:
 *     summary: Create a tag
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TagInput' }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Duplicate name }
 */
router.get(
  '/tags',
  isAdmin,
  validate({ query: listTagsQuerySchema }),
  adminTagController.list,
);
router.post(
  '/tags',
  isAdmin,
  validate({ body: createTagSchema }),
  adminTagController.create,
);

/**
 * @swagger
 * /api/v1/admin/tags/{id}:
 *   put:
 *     summary: Rename a tag
 *     tags: [Admin - Institutions]
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
 *           schema: { $ref: '#/components/schemas/TagInput' }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 *   delete:
 *     summary: Delete a tag
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 */
router.put(
  '/tags/:id',
  isAdmin,
  validate({ params: idParamSchema, body: updateTagSchema }),
  adminTagController.update,
);
router.delete(
  '/tags/:id',
  isAdmin,
  validate({ params: idParamSchema }),
  adminTagController.remove,
);

// ---------------------------------------------------------------------------
// User management (SUPER_ADMIN only)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: List all admin users
 *     tags: [Admin - Users]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: List of admins }
 *       403: { description: Forbidden }
 */
router.get(
  '/users',
  roleGuard(Role.SUPER_ADMIN),
  validate({ query: paginationQuerySchema }),
  userController.list,
);

/**
 * @swagger
 * /api/v1/admin/users:
 *   post:
 *     summary: Create a new admin user
 *     tags: [Admin - Users]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password]
 *             properties:
 *               fullName: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [SUPER_ADMIN, ADMIN], default: ADMIN }
 *     responses:
 *       201: { description: Created }
 *       403: { description: Forbidden }
 *       409: { description: Email exists }
 */
router.post(
  '/users',
  roleGuard(Role.SUPER_ADMIN),
  validate({ body: createUserSchema }),
  userController.create,
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/deactivate:
 *   patch:
 *     summary: Deactivate an admin user
 *     tags: [Admin - Users]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deactivated }
 *       400: { description: Cannot deactivate self }
 *       403: { description: Forbidden / cannot deactivate a Super Admin }
 *       404: { description: Not found }
 */
router.patch(
  '/users/:id/deactivate',
  roleGuard(Role.SUPER_ADMIN),
  validate({ params: idParamSchema }),
  userController.deactivate,
);

// ---------------------------------------------------------------------------
// Audit logs (SUPER_ADMIN only)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/admin/audit-logs:
 *   get:
 *     summary: Paginated audit trail with optional filters
 *     tags: [Admin - Audit]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: actorId
 *         schema: { type: string }
 *         description: Filter by the admin who performed the action
 *       - in: query
 *         name: action
 *         schema: { type: string, enum: [CREATE, UPDATE, DELETE, PUBLISH, UNPUBLISH, DEACTIVATE, IMAGE_UPLOAD] }
 *       - in: query
 *         name: targetModel
 *         schema: { type: string, enum: [INSTITUTION, USER] }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *         description: Only entries at or after this timestamp
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *         description: Only entries at or before this timestamp
 *     responses:
 *       200: { description: Audit log entries }
 *       400: { description: Invalid query parameters }
 *       403: { description: Forbidden }
 */
router.get(
  '/audit-logs',
  roleGuard(Role.SUPER_ADMIN),
  validate({ query: auditLogQuerySchema }),
  auditController.list,
);

export default router;
