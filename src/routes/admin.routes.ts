import { Role } from '@prisma/client';
import { Router } from 'express';
import * as adminExhibitionController from '../controllers/adminExhibition.controller';
import * as adminInstitutionController from '../controllers/adminInstitution.controller';
import * as adminSubCategoryController from '../controllers/adminSubCategory.controller';
import * as adminTagController from '../controllers/adminTag.controller';
import * as auditController from '../controllers/audit.controller';
import * as dashboardController from '../controllers/dashboard.controller';
import * as reviewController from '../controllers/review.controller';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/authenticate';
import { roleGuard } from '../middleware/roleGuard';
import { uploadImage } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  createInstitutionSchema,
  adminListInstitutionsQuerySchema,
  idParamSchema,
  removeImageSchema,
  updateInstitutionSchema,
} from '../validators/institution.validator';
import {
  adminListExhibitionsQuerySchema,
  createExhibitionSchema,
  exhibitionParamsSchema,
  setExhibitionActiveSchema,
  updateExhibitionSchema,
} from '../validators/exhibition.validator';
import {
  createSubCategorySchema,
  listSubCategoriesQuerySchema,
  updateSubCategorySchema,
} from '../validators/subCategory.validator';
import { createTagSchema, listTagsQuerySchema, updateTagSchema } from '../validators/tag.validator';
import { listSubmissionsQuerySchema, rejectSchema } from '../validators/submission.validator';
import { auditLogQuerySchema } from '../validators/audit.validator';
import { listReviewSubmissionsQuerySchema } from '../validators/review.validator';
import { createUserSchema, listUsersQuerySchema } from '../validators/user.validator';

const isAdmin = roleGuard(Role.SUPER_ADMIN, Role.ADMIN);

const router = Router();

// Every admin route requires a valid access token.
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: Admin - Institutions
 *     description: Institution management (ADMIN or SUPER_ADMIN)
 *   - name: Admin - Exhibitions
 *     description: Exhibition management and contributor review queue
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
 *   get:
 *     summary: List all institutions (including drafts / unpublished)
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: area
 *         schema: { type: string, enum: [ISLAND, MAINLAND, OTHER] }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: tag
 *         schema: { type: string, description: Tag id or slug }
 *       - in: query
 *         name: subCategoryId
 *         schema: { type: string }
 *       - in: query
 *         name: isPublished
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: approvalStatus
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *     responses:
 *       200: { description: Paginated institution list }
 *       401: { description: Unauthenticated }
 *       403: { description: Forbidden }
 */
router.get(
  '/institutions',
  roleGuard(Role.SUPER_ADMIN, Role.ADMIN),
  validate({ query: adminListInstitutionsQuerySchema }),
  adminInstitutionController.list,
);

/**
 * @swagger
 * /api/v1/admin/institutions/{id}:
 *   get:
 *     summary: Get a single institution (admin view)
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Institution detail }
 *       404: { description: Not found }
 */
router.get(
  '/institutions/:id',
  roleGuard(Role.SUPER_ADMIN, Role.ADMIN),
  validate({ params: idParamSchema }),
  adminInstitutionController.getById,
);

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
 * /api/v1/admin/institutions/{id}/restore:
 *   post:
 *     summary: Undo a soft delete
 *     description: >
 *       Brings a soft-deleted venue back into the catalogue. It stays
 *       unpublished — republishing is a separate, separately audited decision.
 *       Find deleted records with `GET /admin/institutions?deleted=true`.
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Restored }
 *       400: { description: Institution is not deleted }
 *       404: { description: Not found }
 */
router.post(
  '/institutions/:id/restore',
  roleGuard(Role.SUPER_ADMIN, Role.ADMIN),
  validate({ params: idParamSchema }),
  adminInstitutionController.restore,
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

/**
 * @swagger
 * /api/v1/admin/institutions/{id}/images:
 *   delete:
 *     summary: Remove an image URL from an institution (best-effort S3 delete)
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
 *             required: [url]
 *             properties:
 *               url: { type: string, format: uri }
 *     responses:
 *       200: { description: Image removed }
 *       404: { description: Not found }
 */
router.delete(
  '/institutions/:id/images',
  roleGuard(Role.SUPER_ADMIN, Role.ADMIN),
  validate({ params: idParamSchema, body: removeImageSchema }),
  adminInstitutionController.removeImageHandler,
);

// ---------------------------------------------------------------------------
// Exhibitions (nested under an institution; ADMIN or SUPER_ADMIN)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/admin/institutions/{id}/exhibitions:
 *   get:
 *     summary: List every exhibition for an institution (any approval state)
 *     description: >
 *       Admin-scoped counterpart to GET /api/v1/institutions/{id}/exhibitions.
 *       Returns pending, rejected, inactive and finished exhibitions, and works
 *       for unpublished/draft institutions.
 *     tags: [Admin - Institutions]
 *     security: [{ BearerAuth: [] }]
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
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: scope
 *         schema: { type: string, enum: [live, past, all], default: all }
 *     responses:
 *       200: { description: Exhibitions }
 *       401: { description: Unauthenticated }
 *       403: { description: Forbidden }
 *       404: { description: Institution not found }
 */
router.get(
  '/institutions/:id/exhibitions',
  isAdmin,
  validate({ params: idParamSchema, query: adminListExhibitionsQuerySchema }),
  adminExhibitionController.listForInstitution,
);

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

/**
 * @swagger
 * /api/v1/admin/institutions/{id}/exhibitions/{exhibitionId}/activate:
 *   post:
 *     summary: Set whether an exhibition is publicly active
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
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Active status updated }
 *       404: { description: Not found }
 */
router.post(
  '/institutions/:id/exhibitions/:exhibitionId/activate',
  isAdmin,
  validate({ params: exhibitionParamsSchema, body: setExhibitionActiveSchema }),
  adminExhibitionController.setActive,
);

/**
 * @swagger
 * /api/v1/admin/institutions/{id}/exhibitions/{exhibitionId}/images:
 *   delete:
 *     summary: Remove an image URL from an exhibition
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
 *           schema:
 *             type: object
 *             required: [url]
 *             properties:
 *               url: { type: string, format: uri }
 *     responses:
 *       200: { description: Image removed }
 *       404: { description: Not found }
 */
router.delete(
  '/institutions/:id/exhibitions/:exhibitionId/images',
  isAdmin,
  validate({ params: exhibitionParamsSchema, body: removeImageSchema }),
  adminExhibitionController.removeImageHandler,
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
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED], default: PENDING }
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
 * /api/v1/admin/submissions/exhibitions:
 *   get:
 *     summary: List user-submitted exhibitions by status (default PENDING)
 *     tags: [Admin - Exhibitions]
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
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED], default: PENDING }
 *     responses:
 *       200: { description: Exhibition submissions }
 *       403: { description: Forbidden }
 */
router.get(
  '/submissions/exhibitions',
  isAdmin,
  validate({ query: listSubmissionsQuerySchema }),
  adminExhibitionController.listSubmissions,
);

/**
 * @swagger
 * /api/v1/admin/exhibitions/{id}/approve:
 *   post:
 *     summary: Approve a submitted exhibition
 *     description: >
 *       Approval does not make the exhibition public — activate it separately via
 *       the institution's exhibition activate endpoint.
 *     tags: [Admin - Exhibitions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Exhibition approved }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.post(
  '/exhibitions/:id/approve',
  isAdmin,
  validate({ params: idParamSchema }),
  adminExhibitionController.approve,
);

/**
 * @swagger
 * /api/v1/admin/exhibitions/{id}/reject:
 *   post:
 *     summary: Reject a submitted exhibition with a reviewer note
 *     tags: [Admin - Exhibitions]
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
 *               reviewNote: { type: string, example: Dates clash with a listed event }
 *     responses:
 *       200: { description: Exhibition rejected }
 *       400: { description: reviewNote is required }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.post(
  '/exhibitions/:id/reject',
  isAdmin,
  validate({ params: idParamSchema, body: rejectSchema }),
  adminExhibitionController.reject,
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
// Review moderation (ADMIN or SUPER_ADMIN)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/admin/submissions/reviews:
 *   get:
 *     summary: Review moderation queue
 *     tags: [Admin - Submissions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED], default: PENDING }
 *     responses:
 *       200: { description: Reviews awaiting the chosen status }
 */
router.get(
  '/submissions/reviews',
  isAdmin,
  validate({ query: listReviewSubmissionsQuerySchema }),
  reviewController.listSubmissions,
);

/**
 * @swagger
 * /api/v1/admin/reviews/{id}/approve:
 *   post:
 *     summary: Approve a review
 *     description: >
 *       The review becomes public and joins the venue's average rating, which is
 *       recomputed immediately.
 *     tags: [Admin - Submissions]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Approved }
 *       404: { description: Not found }
 */
router.post(
  '/reviews/:id/approve',
  isAdmin,
  validate({ params: idParamSchema }),
  reviewController.approve,
);

/**
 * @swagger
 * /api/v1/admin/reviews/{id}/reject:
 *   post:
 *     summary: Reject a review with a required moderator note
 *     tags: [Admin - Submissions]
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
  '/reviews/:id/reject',
  isAdmin,
  validate({ params: idParamSchema, body: rejectSchema }),
  reviewController.reject,
);

/**
 * @swagger
 * /api/v1/admin/reviews/{id}:
 *   delete:
 *     summary: Delete any review (spam removal)
 *     tags: [Admin - Submissions]
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
router.delete(
  '/reviews/:id',
  isAdmin,
  validate({ params: idParamSchema }),
  reviewController.removeAsAdmin,
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
 *         schema: { type: string, enum: [ART_GALLERY, MUSEUM, INSTITUTE, FOUNDATION, STUDIO, CULTURAL_SPACE] }
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
router.get('/tags', isAdmin, validate({ query: listTagsQuerySchema }), adminTagController.list);
router.post('/tags', isAdmin, validate({ body: createTagSchema }), adminTagController.create);

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
router.delete('/tags/:id', isAdmin, validate({ params: idParamSchema }), adminTagController.remove);

// ---------------------------------------------------------------------------
// User management (SUPER_ADMIN only)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: List users (staff by default)
 *     description: >
 *       Returns staff accounts (ADMIN + SUPER_ADMIN) unless `role` is supplied.
 *       Pass `role=USER` to list public self-registered accounts, which is the
 *       only way to find them in order to deactivate or reactivate one.
 *     tags: [Admin - Users]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [SUPER_ADMIN, ADMIN, USER] }
 *         description: Filter by a single role. Omit for staff only.
 *     responses:
 *       200: { description: List of users }
 *       403: { description: Forbidden }
 */
router.get(
  '/users',
  roleGuard(Role.SUPER_ADMIN),
  validate({ query: listUsersQuerySchema }),
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

/**
 * @swagger
 * /api/v1/admin/users/{id}/activate:
 *   patch:
 *     summary: Reactivate a deactivated admin user
 *     tags: [Admin - Users]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Activated }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.patch(
  '/users/:id/activate',
  roleGuard(Role.SUPER_ADMIN),
  validate({ params: idParamSchema }),
  userController.activate,
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
 *         schema: { type: string, enum: [CREATE, UPDATE, DELETE, PUBLISH, UNPUBLISH, DEACTIVATE, IMAGE_UPLOAD, SUBMIT, APPROVE, REJECT, APPROVE_USER, REJECT_USER, APPROVE_INSTITUTION, REJECT_INSTITUTION, EXHIBITION_CREATE, EXHIBITION_UPDATE, EXHIBITION_DELETE, APPROVE_EXHIBITION, REJECT_EXHIBITION] }
 *       - in: query
 *         name: targetModel
 *         schema: { type: string, enum: [INSTITUTION, USER, SUBCATEGORY, TAG, EXHIBITION] }
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