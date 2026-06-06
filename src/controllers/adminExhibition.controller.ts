import { Request, Response } from 'express';
import * as exhibitionService from '../services/exhibition.service';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import { uploadExhibitionImage } from '../utils/s3Uploader';
import {
  CreateExhibitionInput,
  UpdateExhibitionInput,
} from '../validators/exhibition.validator';

/** All handlers assume `authenticate` + `roleGuard` ran first, so req.user exists. */
const actorId = (req: Request): string => req.user!.id;

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
