import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import {
  ChangePasswordInput,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
} from '../validators/auth.validator';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RegisterInput;
  const user = await authService.register(body);
  return successResponse(res, user, 'Admin registered successfully', 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;
  const result = await authService.login(email, password);
  return successResponse(res, result, 'Login successful');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as RefreshInput;
  const tokens = await authService.refresh(refreshToken);
  return successResponse(res, tokens, 'Token refreshed');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as LogoutInput;
  await authService.logout(refreshToken);
  return successResponse(res, null, 'Logged out successfully');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getProfile(req.user!.id);
  return successResponse(res, user, 'Current user retrieved');
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  return successResponse(res, null, 'Password changed successfully');
});
