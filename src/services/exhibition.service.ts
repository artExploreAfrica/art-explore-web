import {
  ApprovalStatus,
  AuditAction,
  Exhibition,
  TargetModel,
} from '@prisma/client';
import prisma from '../config/db';
import { NotFoundError } from '../utils/AppError';
import { auditLog } from '../utils/auditLogger';
import { invalidateInstitutionCache } from '../utils/institutionCache';
import {
  CreateExhibitionInput,
  UpdateExhibitionInput,
} from '../validators/exhibition.validator';

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

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
 * Recompute Institution.hasActiveExhibition: true when any exhibition is still
 * running — coalesce(endDate, date) >= start of today. Called after every write.
 */
const recomputeActive = async (institutionId: string): Promise<void> => {
  const today = startOfToday();
  const activeCount = await prisma.exhibition.count({
    where: {
      institutionId,
      OR: [{ endDate: { gte: today } }, { endDate: null, date: { gte: today } }],
    },
  });
  await prisma.institution.update({
    where: { id: institutionId },
    data: { hasActiveExhibition: activeCount > 0 },
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
    where: { institutionId },
    orderBy: { date: 'desc' },
  });
};

export const create = async (
  actorId: string,
  institutionId: string,
  input: CreateExhibitionInput,
): Promise<Exhibition> => {
  await ensureInstitution(institutionId);

  const exhibition = await prisma.exhibition.create({
    data: { ...input, institutionId },
  });

  await recomputeActive(institutionId);
  await auditLog(actorId, AuditAction.CREATE, TargetModel.EXHIBITION, exhibition.id, {
    institutionId,
    title: exhibition.title,
  });
  await invalidateInstitutionCache();
  return exhibition;
};

export const update = async (
  actorId: string,
  institutionId: string,
  exhibitionId: string,
  input: UpdateExhibitionInput,
): Promise<Exhibition> => {
  await ensureExhibition(institutionId, exhibitionId);

  const exhibition = await prisma.exhibition.update({
    where: { id: exhibitionId },
    data: input,
  });

  await recomputeActive(institutionId);
  await auditLog(actorId, AuditAction.UPDATE, TargetModel.EXHIBITION, exhibitionId, {
    institutionId,
    fields: Object.keys(input),
  });
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

  await recomputeActive(institutionId);
  await auditLog(actorId, AuditAction.DELETE, TargetModel.EXHIBITION, exhibitionId, {
    institutionId,
  });
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
  await ensureExhibition(institutionId, exhibitionId);

  const exhibition = await prisma.exhibition.update({
    where: { id: exhibitionId },
    data: { image: imageUrl },
  });

  await auditLog(actorId, AuditAction.IMAGE_UPLOAD, TargetModel.EXHIBITION, exhibitionId, {
    institutionId,
    imageUrl,
  });
  await invalidateInstitutionCache();
  return exhibition;
};
