import { Role } from '@prisma/client';
import { Router } from 'express';
import * as adminInstitutionController from '../controllers/adminInstitution.controller';
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
  createUserSchema,
  paginationQuerySchema,
} from '../validators/user.validator';

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
 * /api/admin/dashboard:
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
 * /api/admin/institutions:
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
 * /api/admin/institutions/{id}:
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
 * /api/admin/institutions/{id}:
 *   delete:
 *     summary: Soft delete an institution (sets isPublished false)
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
 * /api/admin/institutions/{id}/publish:
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
 * /api/admin/institutions/{id}/images:
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
// User management (SUPER_ADMIN only)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/admin/users:
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
 * /api/admin/users:
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
 * /api/admin/users/{id}/deactivate:
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
 * /api/admin/audit-logs:
 *   get:
 *     summary: Paginated audit trail
 *     tags: [Admin - Audit]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Audit log entries }
 *       403: { description: Forbidden }
 */
router.get(
  '/audit-logs',
  roleGuard(Role.SUPER_ADMIN),
  validate({ query: paginationQuerySchema }),
  auditController.list,
);

export default router;
