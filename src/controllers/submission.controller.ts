import { Request, Response } from 'express';
import * as institutionService from '../services/institution.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import {
  MySubmissionsQuery,
  SubmitInstitutionInput,
} from '../validators/submission.validator';

/** POST /api/v1/submissions — a USER submits an institution for review. */
export const submit = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as SubmitInstitutionInput;
  const institution = await institutionService.submit(req.user!.id, body);
  return successResponse(res, institution, 'Submission received and pending review', 201);
});

/** GET /api/v1/submissions/mine — the USER's own submissions. */
export const mine = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as MySubmissionsQuery;
  const { data, pagination } = await institutionService.listMine(req.user!.id, query);
  return successResponse(res, data, 'Your submissions retrieved', 200, pagination);
});
