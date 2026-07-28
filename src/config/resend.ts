import { Resend } from 'resend';
import { env } from './env';

/**
 * Resend client (singleton). Used for transactional email — password resets,
 * submission-review notifications, and staff welcome emails
 * (see src/utils/mailer.ts).
 *
 * When RESEND_API_KEY is unset, `resend` is null and the mailer no-ops.
 */
export const resend: Resend | null = env.RESEND_API_KEY
  ? new Resend(env.RESEND_API_KEY)
  : null;
