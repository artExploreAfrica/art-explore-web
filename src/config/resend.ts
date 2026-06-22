import { Resend } from 'resend';
import { env } from './env';

/**
 * Resend client (singleton). Used only for transactional email — password
 * resets and submission-review notifications (see src/utils/mailer.ts).
 */
export const resend = new Resend(env.RESEND_API_KEY);
