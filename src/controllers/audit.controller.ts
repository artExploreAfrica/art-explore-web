import { Request, Response } from 'express';
import * as auditService from '../services/audit.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import { AuditLogQuery } from '../validators/audit.validator';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as AuditLogQuery;
  const { data, pagination } = await auditService.list(query);
  return successResponse(res, data, 'Audit logs retrieved', 200, pagination);
});
