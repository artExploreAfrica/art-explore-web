import { EnquiryIntent, EnquiryStatus } from '@prisma/client';
import { z } from 'zod';

/**
 * A visitor writing in from the home-page form (options A and B: "reach out",
 * "learn more"). No account needed. `company` is the same honeypot as the
 * public submission form — see publicSubmissionSchema.
 */
export const createEnquirySchema = z.object({
  intent: z.nativeEnum(EnquiryIntent),
  name: z.string().trim().min(1, 'name is required').max(100),
  email: z.string().trim().email('email must be a valid email').max(200),
  organisation: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1, 'message is required').max(2000),
  company: z.string().optional(),
});

/** Admin inbox filter. Defaults to the ones still waiting on a reply. */
export const listEnquiriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(EnquiryStatus).optional().default(EnquiryStatus.NEW),
  intent: z.nativeEnum(EnquiryIntent).optional(),
});

/** Mark an enquiry handled, or reopen it. */
export const updateEnquirySchema = z.object({
  status: z.nativeEnum(EnquiryStatus),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
export type ListEnquiriesQuery = z.infer<typeof listEnquiriesQuerySchema>;
export type UpdateEnquiryInput = z.infer<typeof updateEnquirySchema>;
