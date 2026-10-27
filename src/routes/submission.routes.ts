import { Role } from '@prisma/client';
import { Router } from 'express';
import * as reviewController from '../controllers/review.controller';
import * as submissionController from '../controllers/submission.controller';
import { authenticate } from '../middleware/authenticate';
import { contributorWriteLimiter, publicSubmissionLimiter } from '../middleware/rateLimiter';
import { roleGuard } from '../middleware/roleGuard';
import { uploadImage } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  submitExhibitionSchema,
  updateSubmittedExhibitionSchema,
} from '../validators/exhibition.validator';
import { idParamSchema, removeImageSchema } from '../validators/institution.validator';
import { listReviewsQuerySchema } from '../validators/review.validator';
import {
  mySubmissionsQuerySchema,
  publicSubmissionSchema,
  submitInstitutionSchema,
  updateSubmissionSchema,
} from '../validators/submission.validator';

const router = Router();

/**
 * @swagger
 * /api/v1/submissions/public:
 *   post:
 *     summary: Suggest a venue without an account (created PENDING, unpublished)
 *     description: >
 *       Used by the "Are we missing a gallery?" form on the home page. Accepts
 *       only name, type, area, address, subArea, website, instagram and
 *       description, plus optional submitterName / submitterEmail, which are
 *       stored in the internal notes. Rate limited per IP.
 *     tags: [Submissions]
 *     responses:
 *       201: { description: Suggestion received and pending review }
 *       400: { description: Validation failed }
 *       429: { description: Too many suggestions from this connection }
 */
// Registered before the auth guard below — this one route is public.
router.post(
  '/public',
  publicSubmissionLimiter,
  validate({ body: publicSubmissionSchema }),
  submissionController.submitPublic,
);

// Every other submission route requires an authenticated USER.
router.use(authenticate, roleGuard(Role.USER));

/**
 * @swagger
 * tags:
 *   name: Submissions
 *   description: Contributor submissions — venues, exhibitions and reviews
 */

/**
 * @swagger
 * /api/v1/submissions:
 *   post:
 *     summary: Submit a venue for review (created PENDING, unpublished)
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       201: { description: Submission received and pending review }
 *       429: { description: Too many submissions — rate limited }
 */
router.post(
  '/',
  contributorWriteLimiter,
  validate({ body: submitInstitutionSchema }),
  submissionController.submit,
);

/**
 * @swagger
 * /api/v1/submissions/mine:
 *   get:
 *     summary: List your own venue submissions (any status)
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Your submissions }
 */
router.get(
  '/mine',
  validate({ query: mySubmissionsQuerySchema }),
  submissionController.mine,
);

/**
 * @swagger
 * /api/v1/submissions/reviews/mine:
 *   get:
 *     summary: List your own reviews (any moderation status)
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Your reviews }
 */
router.get(
  '/reviews/mine',
  validate({ query: listReviewsQuerySchema }),
  reviewController.mine,
);

/**
 * @swagger
 * /api/v1/submissions/exhibitions:
 *   post:
 *     summary: Submit an exhibition for a published venue (created PENDING, inactive)
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       201: { description: Submission received and pending review }
 *       429: { description: Too many submissions — rate limited }
 */
router.post(
  '/exhibitions',
  contributorWriteLimiter,
  validate({ body: submitExhibitionSchema }),
  submissionController.submitExhibition,
);

/**
 * @swagger
 * /api/v1/submissions/exhibitions/mine:
 *   get:
 *     summary: List your own exhibition submissions (any status)
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Your exhibition submissions }
 */
router.get(
  '/exhibitions/mine',
  validate({ query: mySubmissionsQuerySchema }),
  submissionController.myExhibitions,
);

// --- Exhibition submission management -------------------------------------
// Declared before the `/:id` venue routes below so the literal "exhibitions"
// segment is never captured as a venue id.

/**
 * @swagger
 * /api/v1/submissions/exhibitions/{id}:
 *   put:
 *     summary: Edit your own pending or rejected exhibition submission
 *     description: Editing returns the submission to PENDING and clears the reviewer note.
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Submission updated and pending review }
 *       409: { description: Already approved — no longer editable by the submitter }
 *   delete:
 *     summary: Withdraw your own exhibition submission
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Submission withdrawn }
 */
router.put(
  '/exhibitions/:id',
  contributorWriteLimiter,
  validate({ params: idParamSchema, body: updateSubmittedExhibitionSchema }),
  submissionController.updateExhibition,
);

router.delete(
  '/exhibitions/:id',
  validate({ params: idParamSchema }),
  submissionController.withdrawExhibition,
);

/**
 * @swagger
 * /api/v1/submissions/exhibitions/{id}/images:
 *   post:
 *     summary: Upload an image to your own exhibition submission (multipart, field "image")
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       201: { description: Image uploaded }
 *       413: { description: Image exceeds the 5 MB limit }
 *   delete:
 *     summary: Remove an image from your own exhibition submission
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Image removed }
 */
router.post(
  '/exhibitions/:id/images',
  contributorWriteLimiter,
  validate({ params: idParamSchema }),
  uploadImage,
  submissionController.uploadExhibitionImageHandler,
);

router.delete(
  '/exhibitions/:id/images',
  validate({ params: idParamSchema, body: removeImageSchema }),
  submissionController.removeExhibitionImageHandler,
);

// --- Venue submission management ------------------------------------------
// A submission is locked the moment it's created — "once submitted it's
// over" — while it's PENDING (awaiting first review) or APPROVED (already
// live). The one door back in: a REJECTED submission can be fixed and
// resubmitted, since that's the whole point of a reviewer leaving a note.

/**
 * @swagger
 * /api/v1/submissions/{id}:
 *   put:
 *     summary: Fix and resubmit your own REJECTED venue submission
 *     description: >
 *       Only usable while REJECTED. A PENDING submission is locked until a
 *       reviewer responds; an APPROVED one is frozen for good. Editing returns
 *       the submission to PENDING and clears the reviewer note.
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Submission updated and pending review }
 *       409: { description: Not REJECTED — still pending review, or already approved }
 *   delete:
 *     summary: Withdraw your own venue submission (soft delete)
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Submission withdrawn }
 */
router.put(
  '/:id',
  contributorWriteLimiter,
  validate({ params: idParamSchema, body: updateSubmissionSchema }),
  submissionController.update,
);

router.delete(
  '/:id',
  validate({ params: idParamSchema }),
  submissionController.withdraw,
);

/**
 * @swagger
 * /api/v1/submissions/{id}/images:
 *   post:
 *     summary: Upload an image to your own venue submission (multipart, field "image")
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       201: { description: Image uploaded }
 *       413: { description: Image exceeds the 5 MB limit }
 *   delete:
 *     summary: Remove an image from your own venue submission
 *     tags: [Submissions]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Image removed }
 */
router.post(
  '/:id/images',
  contributorWriteLimiter,
  validate({ params: idParamSchema }),
  uploadImage,
  submissionController.uploadImageHandler,
);

router.delete(
  '/:id/images',
  validate({ params: idParamSchema, body: removeImageSchema }),
  submissionController.removeImageHandler,
);

export default router;
