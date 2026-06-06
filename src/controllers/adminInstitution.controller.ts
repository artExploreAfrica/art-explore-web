import { Request, Response } from 'express';
import * as institutionService from '../services/institution.service';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import { uploadInstitutionImage } from '../utils/s3Uploader';
import {
  CreateInstitutionInput,
  UpdateInstitutionInput,
} from '../validators/institution.validator';
import {
  ListSubmissionsQuery,
  RejectInput,
} from '../validators/submission.validator';

/** All handlers assume `authenticate` + `roleGuard` ran first, so req.user exists. */
const actorId = (req: Request): string => req.user!.id;

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateInstitutionInput;
  const institution = await institutionService.create(actorId(req), body);
  return successResponse(res, institution, 'Institution created', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateInstitutionInput;
  const institution = await institutionService.update(actorId(req), req.params.id, body);
  return successResponse(res, institution, 'Institution updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const institution = await institutionService.softDelete(actorId(req), req.params.id);
  return successResponse(res, institution, 'Institution deleted');
});

export const publish = asyncHandler(async (req: Request, res: Response) => {
  const institution = await institutionService.togglePublish(actorId(req), req.params.id);
  const message = institution.isPublished ? 'Institution published' : 'Institution unpublished';
  return successResponse(res, institution, message);
});

export const uploadImageHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError('No image file provided (field name must be "image")', 400);
  }
  const url = await uploadInstitutionImage(req.params.id, req.file);
  const institution = await institutionService.addImage(actorId(req), req.params.id, url);
  return successResponse(res, institution, 'Image uploaded', 201);
});

// ---------------------------------------------------------------------------
// Submission review (Feature 5)
// ---------------------------------------------------------------------------

export const listSubmissions = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListSubmissionsQuery;
  const { data, pagination } = await institutionService.listSubmissions(query);
  return successResponse(res, data, 'Submissions retrieved', 200, pagination);
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const institution = await institutionService.approve(actorId(req), req.params.id);
  return successResponse(res, institution, 'Submission approved');
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const { reviewNote } = req.body as RejectInput;
  const institution = await institutionService.reject(actorId(req), req.params.id, reviewNote);
  return successResponse(res, institution, 'Submission rejected');
});
