import { env } from '../config/env';
import { resend } from '../config/resend';

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send a transactional email via Resend. Best-effort: any failure is logged
 * and swallowed (returns false) so callers — password reset, submission
 * notifications — never fail the request because of an email problem.
 *
 * No-op under NODE_ENV=test so the suite never reaches Resend.
 */
export const sendEmail = async ({ to, subject, html, text }: EmailMessage): Promise<boolean> => {
  if (env.NODE_ENV === 'test') return true;

  try {
    // Resend resolves API-level failures (unverified sender, invalid address)
    // into `error` rather than throwing, so both paths must be handled.
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });
    if (error) {
      console.error(`[mailer] failed to send "${subject}" to ${to}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[mailer] failed to send "${subject}" to ${to}:`, err);
    return false;
  }
};

/** Password-reset email with a one-hour reset link. */
export const sendPasswordResetEmail = (
  to: string,
  fullName: string,
  resetUrl: string,
): Promise<boolean> =>
  sendEmail({
    to,
    subject: 'Reset your Art Explore password',
    html:
      `<p>Hi ${fullName},</p>` +
      `<p>We received a request to reset your Art Explore password. ` +
      `Click the link below to choose a new one. This link expires in 1 hour.</p>` +
      `<p><a href="${resetUrl}">Reset my password</a></p>` +
      `<p>If you didn't request this, you can safely ignore this email.</p>`,
    text:
      `Hi ${fullName},\n\n` +
      `We received a request to reset your Art Explore password. ` +
      `Open this link to choose a new one (expires in 1 hour):\n${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
  });

/** Notify a submitter that their venue was approved. */
export const sendSubmissionApprovedEmail = (
  to: string,
  fullName: string,
  institutionName: string,
): Promise<boolean> =>
  sendEmail({
    to,
    subject: `Your submission "${institutionName}" was approved`,
    html:
      `<p>Hi ${fullName},</p>` +
      `<p>Good news — your submission <strong>${institutionName}</strong> has been ` +
      `approved by our team. It will appear publicly once it is published.</p>` +
      `<p>Thank you for contributing to Art Explore.</p>`,
    text:
      `Hi ${fullName},\n\n` +
      `Good news — your submission "${institutionName}" has been approved by our team. ` +
      `It will appear publicly once it is published.\n\n` +
      `Thank you for contributing to Art Explore.`,
  });

/** Notify a submitter that their venue was rejected, with the reviewer's note. */
export const sendSubmissionRejectedEmail = (
  to: string,
  fullName: string,
  institutionName: string,
  reviewNote: string,
): Promise<boolean> =>
  sendEmail({
    to,
    subject: `Update on your submission "${institutionName}"`,
    html:
      `<p>Hi ${fullName},</p>` +
      `<p>Thank you for your submission <strong>${institutionName}</strong>. ` +
      `After review, we're unable to publish it at this time.</p>` +
      `<p><strong>Reviewer note:</strong> ${reviewNote}</p>` +
      `<p>You're welcome to submit again with the suggested changes.</p>`,
    text:
      `Hi ${fullName},\n\n` +
      `Thank you for your submission "${institutionName}". After review, we're unable ` +
      `to publish it at this time.\n\n` +
      `Reviewer note: ${reviewNote}\n\n` +
      `You're welcome to submit again with the suggested changes.`,
  });
