import { Request, Response } from 'express';
import * as enquiryService from '../services/enquiry.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import {
  CreateEnquiryInput,
  ListEnquiriesQuery,
  UpdateEnquiryInput,
} from '../validators/enquiry.validator';

/**
 * POST /api/v1/enquiries — public contact form, no account.
 *
 * Like the public submission endpoint, it answers with an acknowledgement
 * only, and a filled honeypot gets the same 201 without saving.
 */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateEnquiryInput;
  if (!body.company) {
    await enquiryService.create(body);
  }
  return successResponse(res, null, 'Thanks — your message is with the team', 201);
});

/** GET /api/v1/admin/enquiries — admin inbox. */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListEnquiriesQuery;
  const { data, pagination } = await enquiryService.list(query);
  return successResponse(res, data, 'Enquiries retrieved', 200, pagination);
});

/** PATCH /api/v1/admin/enquiries/:id — mark handled or reopen. */
export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateEnquiryInput;
  const enquiry = await enquiryService.updateStatus(req.user!.id, req.params.id, body);
  return successResponse(res, enquiry, 'Enquiry updated');
});
