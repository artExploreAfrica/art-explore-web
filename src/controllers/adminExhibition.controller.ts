import { Request, Response } from 'express';
import * as exhibitionService from '../services/exhibition.service';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import { uploadExhibitionImage } from '../utils/s3Uploader';
import {
  AdminListExhibitionsQuery,
  CreateExhibitionInput,
  UpdateExhibitionInput,
} from '../validators/exhibition.validator';
import { ListSubmissionsQuery } from '../validators/submission.validator';

/** All handlers assume `authenticate` + `roleGuard` ran first, so req.user exists. */
const actorId = (req: Request): string => req.user!.id;

/** GET /api/v1/admin/institutions/:id/exhibitions — every exhibition for a venue. */
export const listForInstitution = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as AdminListExhibitionsQuery;
  const { data, pagination } = await exhibitionService.listForAdminInstitution(
    req.params.id,
    query,
  );
  return successResponse(res, data, 'Exhibitions retrieved', 200, pagination);
});

/** GET /api/v1/admin/submissions/exhibitions — contributor exhibition review queue. */
export const listSubmissions = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListSubmissionsQuery;
  const { data, pagination } = await exhibitionService.listSubmissions(query);
  return successResponse(res, data, 'Exhibition submissions retrieved', 200, pagination);
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const exhibition = await exhibitionService.approve(actorId(req), req.params.id);
  return successResponse(res, exhibition, 'Exhibition approved');
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const { reviewNote } = req.body as { reviewNote: string };
  const exhibition = await exhibitionService.reject(actorId(req), req.params.id, reviewNote);
  return successResponse(res, exhibition, 'Exhibition rejected');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateExhibitionInput;
  const exhibition = await exhibitionService.create(actorId(req), req.params.id, body);
  return successResponse(res, exhibition, 'Exhibition created', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateExhibitionInput;
  const exhibition = await exhibitionService.update(
    actorId(req),
    req.params.id,
    req.params.exhibitionId,
    body,
  );
  return successResponse(res, exhibition, 'Exhibition updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const exhibition = await exhibitionService.remove(
    actorId(req),
    req.params.id,
    req.params.exhibitionId,
  );
  return successResponse(res, exhibition, 'Exhibition deleted');
});

export const uploadImageHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError('No image file provided (field name must be "image")', 400);
  }
  const url = await uploadExhibitionImage(req.params.id, req.params.exhibitionId, req.file);
  const exhibition = await exhibitionService.addImage(
    actorId(req),
    req.params.id,
    req.params.exhibitionId,
    url,
  );
  return successResponse(res, exhibition, 'Image uploaded', 201);
});

export const setActive = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.body as { isActive: boolean };
  const exhibition = await exhibitionService.setActive(
    actorId(req),
    req.params.id,
    req.params.exhibitionId,
    isActive,
  );
  const message = exhibition.isActive ? 'Exhibition activated' : 'Exhibition deactivated';
  return successResponse(res, exhibition, message);
});

export const removeImageHandler = asyncHandler(async (req: Request, res: Response) => {
  const { url } = req.body as { url: string };
  const exhibition = await exhibitionService.removeImage(
    actorId(req),
    req.params.id,
    req.params.exhibitionId,
    url,
  );
  return successResponse(res, exhibition, 'Image removed');
});