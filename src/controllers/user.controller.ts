import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import { CreateUserInput, PaginationQuery } from '../validators/user.validator';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as PaginationQuery;
  const { data, pagination } = await userService.list(query);
  return successResponse(res, data, 'Admin users retrieved', 200, pagination);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateUserInput;
  const user = await userService.create(req.user!.id, body);
  return successResponse(res, user, 'Admin user created', 201);
});

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.deactivate(req.user!.id, req.params.id);
  return successResponse(res, user, 'Admin user deactivated');
});
