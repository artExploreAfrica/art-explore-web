import { Request, Response } from 'express';
import * as subCategoryService from '../services/subCategory.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import {
  CreateSubCategoryInput,
  ListSubCategoriesQuery,
  UpdateSubCategoryInput,
} from '../validators/subCategory.validator';

/** All handlers assume `authenticate` + `roleGuard` ran first, so req.user exists. */
const actorId = (req: Request): string => req.user!.id;

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListSubCategoriesQuery;
  const { data, pagination } = await subCategoryService.list(query);
  return successResponse(res, data, 'Sub-categories retrieved', 200, pagination);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateSubCategoryInput;
  const subCategory = await subCategoryService.create(actorId(req), body);
  return successResponse(res, subCategory, 'Sub-category created', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateSubCategoryInput;
  const subCategory = await subCategoryService.update(actorId(req), req.params.id, body);
  return successResponse(res, subCategory, 'Sub-category updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const subCategory = await subCategoryService.remove(actorId(req), req.params.id);
  return successResponse(res, subCategory, 'Sub-category deleted');
});
