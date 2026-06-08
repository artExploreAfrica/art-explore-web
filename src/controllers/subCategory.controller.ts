import { Request, Response } from 'express';
import * as subCategoryService from '../services/subCategory.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import { ListSubCategoriesQuery } from '../validators/subCategory.validator';

/** GET /api/v1/subcategories — public list for filter UIs. */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListSubCategoriesQuery;
  const { data, pagination } = await subCategoryService.list(query);
  return successResponse(res, data, 'Sub-categories retrieved', 200, pagination);
});
