import { Request, Response } from 'express';
import * as institutionService from '../services/institution.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import { ListInstitutionsQuery } from '../validators/institution.validator';

/** GET /api/v1/institutions — public paginated list. */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListInstitutionsQuery;
  const { data, pagination } = await institutionService.listPublished(query);
  return successResponse(res, data, 'Institutions retrieved', 200, pagination);
});

/** GET /api/v1/institutions/map — lightweight pins for the map. */
export const map = asyncHandler(async (_req: Request, res: Response) => {
  const pins = await institutionService.getMapPins();
  return successResponse(res, pins, 'Map data retrieved');
});

/** GET /api/v1/institutions/:id — single published institution. */
export const detail = asyncHandler(async (req: Request, res: Response) => {
  const institution = await institutionService.getById(req.params.id);
  return successResponse(res, institution, 'Institution retrieved');
});
