import { Request, Response } from 'express';
import * as tagService from '../services/tag.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import {
  CreateTagInput,
  ListTagsQuery,
  UpdateTagInput,
} from '../validators/tag.validator';

/** All handlers assume `authenticate` + `roleGuard` ran first, so req.user exists. */
const actorId = (req: Request): string => req.user!.id;

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListTagsQuery;
  const { data, pagination } = await tagService.listForAdmin(query);
  return successResponse(res, data, 'Tags retrieved', 200, pagination);
});

/** One tag with the spaces that carry it — feeds the edit form. */
export const getById = asyncHandler(async (req: Request, res: Response) => {
  const tag = await tagService.getForAdmin(req.params.id);
  return successResponse(res, tag, 'Tag retrieved');
});

/** Every space the tag form can link, for its searchable picker. */
export const spaceOptions = asyncHandler(async (_req: Request, res: Response) => {
  const spaces = await tagService.listSpaceOptions();
  return successResponse(res, spaces, 'Spaces retrieved');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateTagInput;
  const tag = await tagService.create(actorId(req), body);
  return successResponse(res, tag, 'Tag created', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateTagInput;
  const tag = await tagService.update(actorId(req), req.params.id, body);
  return successResponse(res, tag, 'Tag updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const tag = await tagService.remove(actorId(req), req.params.id);
  return successResponse(res, tag, 'Tag deleted');
});
