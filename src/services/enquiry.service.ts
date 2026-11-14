import { AuditAction, Enquiry, EnquiryStatus, Prisma, TargetModel } from '@prisma/client';
import prisma from '../config/db';
import { NotFoundError } from '../utils/AppError';
import { auditLog } from '../utils/auditLogger';
import { PaginationMeta } from '../utils/response';
import {
  CreateEnquiryInput,
  ListEnquiriesQuery,
  UpdateEnquiryInput,
} from '../validators/enquiry.validator';

interface ListResult {
  data: Enquiry[];
  pagination: PaginationMeta;
}

/** Store a contact-form message. Always lands NEW for the admin inbox. */
export const create = async (input: CreateEnquiryInput): Promise<Enquiry> => {
  const { company: _honeypot, ...fields } = input;
  return prisma.enquiry.create({ data: { ...fields, status: EnquiryStatus.NEW } });
};

/** Admin inbox, newest first. */
export const list = async (query: ListEnquiriesQuery): Promise<ListResult> => {
  const { page, limit, status, intent } = query;
  const where: Prisma.EnquiryWhereInput = { status, ...(intent && { intent }) };

  const [data, total] = await Promise.all([
    prisma.enquiry.findMany({
      where,
      include: { handledBy: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.enquiry.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
  };
};

/** Mark handled (records who and when) or reopen (clears both). */
export const updateStatus = async (
  actorId: string,
  id: string,
  input: UpdateEnquiryInput,
): Promise<Enquiry> => {
  const existing = await prisma.enquiry.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw NotFoundError('Enquiry');

  const handled = input.status === EnquiryStatus.HANDLED;
  const enquiry = await prisma.enquiry.update({
    where: { id },
    data: {
      status: input.status,
      handledById: handled ? actorId : null,
      handledAt: handled ? new Date() : null,
    },
  });

  await auditLog(actorId, AuditAction.UPDATE, TargetModel.ENQUIRY, id, { status: input.status });
  return enquiry;
};
