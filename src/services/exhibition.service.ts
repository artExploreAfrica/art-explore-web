import {
  ApprovalStatus,
  AuditAction,
  Exhibition,
  TargetModel,
} from '@prisma/client';
import prisma from '../config/db';
import { AppError, NotFoundError } from '../utils/AppError';
import { auditLog } from '../utils/auditLogger';
import { invalidateInstitutionCache } from '../utils/institutionCache';
import { deleteS3ObjectByUrl } from '../utils/s3Uploader';
import {
  CreateExhibitionInput,
  UpdateExhibitionInput,
} from '../validators/exhibition.validator';

/** Admin-facing fetch of the parent institution (excludes soft-deleted). */
const ensureInstitution = async (institutionId: string): Promise<void> => {
  const institution = await prisma.institution.findFirst({
    where: { id: institutionId, deletedAt: null },
    select: { id: true },
  });
  if (!institution) throw NotFoundError('Institution');
};

const ensureExhibition = async (
  institutionId: string,
  exhibitionId: string,
): Promise<Exhibition> => {
  const exhibition = await prisma.exhibition.findFirst({
    where: { id: exhibitionId, institutionId },
  });
  if (!exhibition) throw NotFoundError('Exhibition');
  return exhibition;
};

/**
 * Recompute Institution.hasExhibition: true when the institution has at least one
 * approved exhibition. Called after every write (v2).
 */
const recomputeHasExhibition = async (institutionId: string): Promise<void> => {
  const approvedCount = await prisma.exhibition.count({
    where: { institutionId, approvalStatus: ApprovalStatus.APPROVED },
  });
  await prisma.institution.update({
    where: { id: institutionId },
    data: { hasExhibition: approvedCount > 0 },
  });
};

/** Public read — only for a published, approved institution. */
export const listForInstitution = async (
  institutionId: string,
): Promise<Exhibition[]> => {
  const institution = await prisma.institution.findFirst({
    where: {
      id: institutionId,
      isPublished: true,
      deletedAt: null,
      approvalStatus: ApprovalStatus.APPROVED,
    },
    select: { id: true },
  });
  if (!institution) throw NotFoundError('Institution');

  return prisma.exhibition.findMany({
    where: {
      institutionId,
      approvalStatus: ApprovalStatus.APPROVED,
      isActive: true,
    },
    orderBy: { startDate: 'desc' },
  });
};

export const create = async (
  actorId: string,
  institutionId: string,
  input: CreateExhibitionInput,
): Promise<Exhibition> => {
  await ensureInstitution(institutionId);

  // Admins create exhibitions directly — they bypass the approval queue (v2).
  const exhibition = await prisma.exhibition.create({
    data: {
      ...input,
      institutionId,
      approvalStatus: ApprovalStatus.APPROVED,
      isActive: true,
      submittedById: actorId,
      approvedById: actorId,
      approvedAt: new Date(),
    },
  });

  await recomputeHasExhibition(institutionId);
  await auditLog(
    actorId,
    AuditAction.EXHIBITION_CREATE,
    TargetModel.EXHIBITION,
    exhibition.id,
    { institutionId, name: exhibition.name },
  );
  await invalidateInstitutionCache();
  return exhibition;
};

export const update = async (
  actorId: string,
  institutionId: string,
  exhibitionId: string,
  input: UpdateExhibitionInput,
): Promise<Exhibition> => {
  const current = await ensureExhibition(institutionId, exhibitionId);

  // A partial update supplying only one date is validated against the stored
  // value, so the merged range can never end up inverted.
  const startDate = input.startDate ?? current.startDate;
  const endDate = input.endDate ?? current.endDate;
  if (endDate < startDate) {
    throw new AppError('endDate must be on or after startDate', 400);
  }

  const exhibition = await prisma.exhibition.update({
    where: { id: exhibitionId },
    data: input,
  });

  await recomputeHasExhibition(institutionId);
  await auditLog(
    actorId,
    AuditAction.EXHIBITION_UPDATE,
    TargetModel.EXHIBITION,
    exhibitionId,
    { institutionId, fields: Object.keys(input) },
  );
  await invalidateInstitutionCache();
  return exhibition;
};

export const remove = async (
  actorId: string,
  institutionId: string,
  exhibitionId: string,
): Promise<Exhibition> => {
  await ensureExhibition(institutionId, exhibitionId);

  const exhibition = await prisma.exhibition.delete({ where: { id: exhibitionId } });

  await recomputeHasExhibition(institutionId);
  await auditLog(
    actorId,
    AuditAction.EXHIBITION_DELETE,
    TargetModel.EXHIBITION,
    exhibitionId,
    { institutionId },
  );
  await invalidateInstitutionCache();
  return exhibition;
};

/** Attach an uploaded image URL to an exhibition and log it. */
export const addImage = async (
  actorId: string,
  institutionId: string,
  exhibitionId: string,
  imageUrl: string,
): Promise<Exhibition> => {
  const current = await ensureExhibition(institutionId, exhibitionId);

  const exhibition = await prisma.exhibition.update({
    where: { id: exhibitionId },
    data: { images: [...current.images, imageUrl] },
  });

  await auditLog(actorId, AuditAction.IMAGE_UPLOAD, TargetModel.EXHIBITION, exhibitionId, {
    institutionId,
    imageUrl,
  });
  await invalidateInstitutionCache();
  return exhibition;
};

/** Toggle whether an exhibition is publicly active. */
export const setActive = async (
  actorId: string,
  institutionId: string,
  exhibitionId: string,
  isActive: boolean,
): Promise<Exhibition> => {
  await ensureExhibition(institutionId, exhibitionId);

  const exhibition = await prisma.exhibition.update({
    where: { id: exhibitionId },
    data: { isActive },
  });

  await auditLog(
    actorId,
    AuditAction.EXHIBITION_UPDATE,
    TargetModel.EXHIBITION,
    exhibitionId,
    { institutionId, isActive },
  );
  await invalidateInstitutionCache();
  return exhibition;
};

/** Remove an image URL from an exhibition and best-effort delete the S3 object. */
export const removeImage = async (
  actorId: string,
  institutionId: string,
  exhibitionId: string,
  imageUrl: string,
): Promise<Exhibition> => {
  const current = await ensureExhibition(institutionId, exhibitionId);

  if (!current.images.includes(imageUrl)) {
    throw new AppError('Image URL not found on this exhibition', 404);
  }

  const exhibition = await prisma.exhibition.update({
    where: { id: exhibitionId },
    data: { images: current.images.filter((url) => url !== imageUrl) },
  });

  await deleteS3ObjectByUrl(imageUrl);

  await auditLog(actorId, AuditAction.EXHIBITION_UPDATE, TargetModel.EXHIBITION, exhibitionId, {
    institutionId,
    removedImageUrl: imageUrl,
  });
  await invalidateInstitutionCache();
  return exhibition;
};
