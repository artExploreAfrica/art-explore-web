import { Request, Response } from 'express';
import * as auditService from '../services/audit.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import { PaginationQuery } from '../validators/user.validator';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as PaginationQuery;
  const { data, pagination } = await auditService.list(query);
  return successResponse(res, data, 'Audit logs retrieved', 200, pagination);
});
