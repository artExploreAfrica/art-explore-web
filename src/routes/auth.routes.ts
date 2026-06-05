import { Role } from '@prisma/client';
import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { authLimiter } from '../middleware/rateLimiter';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import {
  changePasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from '../validators/auth.validator';

const router = Router();

// Throttle all auth endpoints to blunt credential brute-forcing.
router.use(authLimiter);

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication & admin account issuance
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new admin (Super Admin only)
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password]
 *             properties:
 *               fullName: { type: string, example: Jane Doe }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [SUPER_ADMIN, ADMIN], default: ADMIN }
 *     responses:
 *       201: { description: Admin registered, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessResponse' } } } }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Unauthenticated }
 *       403: { description: Not a Super Admin }
 *       409: { description: Email already exists }
 */
router.post(
  '/register',
  authenticate,
  roleGuard(Role.SUPER_ADMIN),
  validate({ body: registerSchema }),
  authController.register,
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in and receive access + refresh tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessResponse' } } } }
 *       400: { description: Validation error }
 *       401: { description: Invalid credentials }
 *       403: { description: Account deactivated }
 */
router.post('/login', validate({ body: loginSchema }), authController.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Exchange a refresh token for a new token pair
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Token refreshed }
 *       401: { description: Invalid, expired, or revoked refresh token }
 */
router.post('/refresh', validate({ body: refreshSchema }), authController.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Invalidate a refresh token (deletes it from Redis)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Logged out }
 */
router.post('/logout', validate({ body: logoutSchema }), authController.logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get the authenticated admin's own profile
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { description: Current user, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessResponse' } } } }
 *       401: { description: Unauthenticated }
 */
router.get('/me', authenticate, authController.me);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change the authenticated admin's own password
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password changed; other sessions revoked }
 *       400: { description: Validation error }
 *       401: { description: Unauthenticated or wrong current password }
 */
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);

export default router;
