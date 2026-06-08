import { Request, Response } from 'express';
import * as tagService from '../services/tag.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import { ListTagsQuery } from '../validators/tag.validator';

/** GET /api/v1/tags — public list for filter UIs. */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListTagsQuery;
  const { data, pagination } = await tagService.list(query);
  return successResponse(res, data, 'Tags retrieved', 200, pagination);
});
