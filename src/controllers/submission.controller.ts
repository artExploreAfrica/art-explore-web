import { Request, Response } from 'express';
import * as exhibitionService from '../services/exhibition.service';
import * as institutionService from '../services/institution.service';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import {
  uploadExhibitionImage,
  uploadInstitutionImage,
} from '../utils/s3Uploader';
import {
  SubmitExhibitionInput,
  UpdateSubmittedExhibitionInput,
} from '../validators/exhibition.validator';
import { RemoveImageInput } from '../validators/institution.validator';
import {
  MySubmissionsQuery,
  SubmitInstitutionInput,
  UpdateSubmissionInput,
} from '../validators/submission.validator';

/** POST /api/v1/submissions — a USER submits an institution for review. */
export const submit = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as SubmitInstitutionInput;
  const institution = await institutionService.submit(req.user!.id, body);
  return successResponse(res, institution, 'Submission received and pending review', 201);
});

/** GET /api/v1/submissions/mine — the USER's own submissions. */
export const mine = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as MySubmissionsQuery;
  const { data, pagination } = await institutionService.listMine(req.user!.id, query);
  return successResponse(res, data, 'Your submissions retrieved', 200, pagination);
});

/** POST /api/v1/submissions/exhibitions — a USER submits an exhibition for review. */
export const submitExhibition = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as SubmitExhibitionInput;
  const exhibition = await exhibitionService.submit(req.user!.id, body);
  return successResponse(res, exhibition, 'Submission received and pending review', 201);
});

/** GET /api/v1/submissions/exhibitions/mine — the USER's own exhibition submissions. */
export const myExhibitions = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as MySubmissionsQuery;
  const { data, pagination } = await exhibitionService.listMine(req.user!.id, query);
  return successResponse(res, data, 'Your exhibition submissions retrieved', 200, pagination);
});

// ---------------------------------------------------------------------------
// Edit / withdraw / images — a contributor managing their own submissions.
// ---------------------------------------------------------------------------

/** PUT /api/v1/submissions/:id — fix and resubmit an own REJECTED venue submission. */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateSubmissionInput;
  const institution = await institutionService.updateMine(
    req.user!.id,
    req.params.id,
    body,
  );
  return successResponse(res, institution, 'Submission updated and pending review');
});

/** DELETE /api/v1/submissions/:id — withdraw an own venue submission. */
export const withdraw = asyncHandler(async (req: Request, res: Response) => {
  const institution = await institutionService.withdrawMine(req.user!.id, req.params.id);
  return successResponse(res, institution, 'Submission withdrawn');
});

/** POST /api/v1/submissions/:id/images — upload an image to an own submission. */
export const uploadImageHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError('No image file provided (field name must be "image")', 400);
  }
  // Confirm ownership BEFORE writing to S3 — otherwise any authenticated user
  // could deposit bytes under an arbitrary institution's prefix and only then
  // be told 404, leaving an orphaned object behind.
  const existing = await institutionService.getMineForUpload(
    req.user!.id,
    req.params.id,
  );
  const url = await uploadInstitutionImage(existing.id, req.file);
  const institution = await institutionService.addImageToMine(
    req.user!.id,
    existing.id,
    url,
  );
  return successResponse(res, institution, 'Image uploaded', 201);
});

/** DELETE /api/v1/submissions/:id/images — remove an image from an own submission. */
export const removeImageHandler = asyncHandler(async (req: Request, res: Response) => {
  const { url } = req.body as RemoveImageInput;
  const institution = await institutionService.removeImageFromMine(
    req.user!.id,
    req.params.id,
    url,
  );
  return successResponse(res, institution, 'Image removed');
});

/** PUT /api/v1/submissions/exhibitions/:id — edit an own exhibition submission. */
export const updateExhibition = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateSubmittedExhibitionInput;
  const exhibition = await exhibitionService.updateMine(
    req.user!.id,
    req.params.id,
    body,
  );
  return successResponse(res, exhibition, 'Submission updated and pending review');
});

/** DELETE /api/v1/submissions/exhibitions/:id — withdraw an own exhibition submission. */
export const withdrawExhibition = asyncHandler(async (req: Request, res: Response) => {
  const exhibition = await exhibitionService.withdrawMine(req.user!.id, req.params.id);
  return successResponse(res, exhibition, 'Submission withdrawn');
});

/** POST /api/v1/submissions/exhibitions/:id/images — upload to an own submission. */
export const uploadExhibitionImageHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('No image file provided (field name must be "image")', 400);
    }
    const existing = await exhibitionService.getMineForUpload(
      req.user!.id,
      req.params.id,
    );
    const url = await uploadExhibitionImage(
      existing.institutionId,
      existing.id,
      req.file,
    );
    const exhibition = await exhibitionService.addImageToMine(
      req.user!.id,
      req.params.id,
      url,
    );
    return successResponse(res, exhibition, 'Image uploaded', 201);
  },
);

/** DELETE /api/v1/submissions/exhibitions/:id/images — remove an own submission image. */
export const removeExhibitionImageHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { url } = req.body as RemoveImageInput;
    const exhibition = await exhibitionService.removeImageFromMine(
      req.user!.id,
      req.params.id,
      url,
    );
    return successResponse(res, exhibition, 'Image removed');
  },
);
