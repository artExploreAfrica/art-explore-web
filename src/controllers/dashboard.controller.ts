import { Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';

export const counts = asyncHandler(async (_req: Request, res: Response) => {
  const data = await dashboardService.getCounts();
  return successResponse(res, data, 'Dashboard counts retrieved');
});
