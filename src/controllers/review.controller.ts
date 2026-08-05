import { Request, Response } from 'express';
import * as reviewService from '../services/review.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import {
  CreateReviewInput,
  ListReviewSubmissionsQuery,
  ListReviewsQuery,
  UpdateReviewInput,
} from '../validators/review.validator';

/** GET /api/v1/institutions/:id/reviews — approved reviews for a venue. */
export const listForInstitution = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListReviewsQuery;
  const { data, pagination } = await reviewService.listForInstitution(
    req.params.id,
    query,
  );
  return successResponse(res, data, 'Reviews retrieved', 200, pagination);
});

/** POST /api/v1/institutions/:id/reviews — a USER reviews a venue. */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateReviewInput;
  const review = await reviewService.create(req.user!.id, req.params.id, body);
  return successResponse(res, review, 'Review submitted and pending moderation', 201);
});

/** PUT /api/v1/reviews/:id — a USER edits their own review. */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateReviewInput;
  const review = await reviewService.update(req.user!.id, req.params.id, body);
  return successResponse(res, review, 'Review updated and pending moderation');
});

/** DELETE /api/v1/reviews/:id — a USER deletes their own review. */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviewService.remove(req.user!.id, req.params.id);
  return successResponse(res, review, 'Review deleted');
});

/** GET /api/v1/submissions/reviews/mine — the USER's own reviews, any status. */
export const mine = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListReviewsQuery;
  const { data, pagination } = await reviewService.listMine(req.user!.id, query);
  return successResponse(res, data, 'Your reviews retrieved', 200, pagination);
});

// ---------------------------------------------------------------------------
// Admin moderation
// ---------------------------------------------------------------------------

/** GET /api/v1/admin/submissions/reviews — moderation queue. */
export const listSubmissions = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListReviewSubmissionsQuery;
  const { data, pagination } = await reviewService.listSubmissions(query);
  return successResponse(res, data, 'Review submissions retrieved', 200, pagination);
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviewService.approve(req.user!.id, req.params.id);
  return successResponse(res, review, 'Review approved');
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const { reviewNote } = req.body as { reviewNote: string };
  const review = await reviewService.reject(req.user!.id, req.params.id, reviewNote);
  return successResponse(res, review, 'Review rejected');
});

/** DELETE /api/v1/admin/reviews/:id — admin removes any review. */
export const removeAsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviewService.removeAsAdmin(req.user!.id, req.params.id);
  return successResponse(res, review, 'Review deleted');
});
