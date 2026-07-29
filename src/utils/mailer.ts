import { Role } from '@prisma/client';
import { env } from '../config/env';
import { resend } from '../config/resend';

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Escape HTML special characters in user-controlled strings. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Send a transactional email via Resend. Best-effort: any failure is logged
 * and swallowed (returns false) so callers never fail the request because of
 * an email problem.
 *
 * No-op when RESEND_API_KEY is unset, or under NODE_ENV=test.
 */
export const sendEmail = async ({ to, subject, html, text }: EmailMessage): Promise<boolean> => {
  if (env.NODE_ENV === 'test') return true;

  if (!resend || !env.RESEND_API_KEY) {
    console.warn(
      `[mailer] skipping "${subject}" to ${to} — RESEND_API_KEY is not configured`,
    );
    return false;
  }

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
): Promise<boolean> => {
  const name = escapeHtml(fullName);
  const safeUrl = escapeHtml(resetUrl);
  return sendEmail({
    to,
    subject: 'Reset your Art Explore password',
    html:
      `<p>Hi ${name},</p>` +
      `<p>We received a request to reset your Art Explore password. ` +
      `Click the link below to choose a new one. This link expires in 1 hour.</p>` +
      `<p><a href="${safeUrl}">Reset my password</a></p>` +
      `<p>If you didn't request this, you can safely ignore this email.</p>`,
    text:
      `Hi ${fullName},\n\n` +
      `We received a request to reset your Art Explore password. ` +
      `Open this link to choose a new one (expires in 1 hour):\n${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
  });
};

/** Notify a submitter that their venue was approved. */
export const sendSubmissionApprovedEmail = (
  to: string,
  fullName: string,
  institutionName: string,
): Promise<boolean> => {
  const name = escapeHtml(fullName);
  const venue = escapeHtml(institutionName);
  return sendEmail({
    to,
    subject: `Your submission "${institutionName}" was approved`,
    html:
      `<p>Hi ${name},</p>` +
      `<p>Good news — your submission <strong>${venue}</strong> has been ` +
      `approved by our team. It will appear publicly once it is published.</p>` +
      `<p>Thank you for contributing to Art Explore.</p>`,
    text:
      `Hi ${fullName},\n\n` +
      `Good news — your submission "${institutionName}" has been approved by our team. ` +
      `It will appear publicly once it is published.\n\n` +
      `Thank you for contributing to Art Explore.`,
  });
};

/** Notify a submitter that their venue was rejected, with the reviewer's note. */
export const sendSubmissionRejectedEmail = (
  to: string,
  fullName: string,
  institutionName: string,
  reviewNote: string,
): Promise<boolean> => {
  const name = escapeHtml(fullName);
  const venue = escapeHtml(institutionName);
  const note = escapeHtml(reviewNote);
  return sendEmail({
    to,
    subject: `Update on your submission "${institutionName}"`,
    html:
      `<p>Hi ${name},</p>` +
      `<p>Thank you for your submission <strong>${venue}</strong>. ` +
      `After review, we're unable to publish it at this time.</p>` +
      `<p><strong>Reviewer note:</strong> ${note}</p>` +
      `<p>You're welcome to submit again with the suggested changes.</p>`,
    text:
      `Hi ${fullName},\n\n` +
      `Thank you for your submission "${institutionName}". After review, we're unable ` +
      `to publish it at this time.\n\n` +
      `Reviewer note: ${reviewNote}\n\n` +
      `You're welcome to submit again with the suggested changes.`,
  });
};

/** Welcome email when a Super Admin creates a staff account. */
export const sendWelcomeEmail = (
  to: string,
  fullName: string,
  role: Role,
): Promise<boolean> => {
  const name = escapeHtml(fullName);
  const loginUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/login`;
  const safeLogin = escapeHtml(loginUrl);
  const roleLabel = role === Role.SUPER_ADMIN ? 'Super Admin' : 'Admin';
  return sendEmail({
    to,
    subject: 'Welcome to Art Explore',
    html:
      `<p>Hi ${name},</p>` +
      `<p>An Art Explore ${escapeHtml(roleLabel)} account has been created for you.</p>` +
      `<p>Sign in here: <a href="${safeLogin}">${safeLogin}</a></p>` +
      `<p>If you were not expecting this, contact your Super Admin.</p>`,
    text:
      `Hi ${fullName},\n\n` +
      `An Art Explore ${roleLabel} account has been created for you.\n` +
      `Sign in here: ${loginUrl}\n\n` +
      `If you were not expecting this, contact your Super Admin.`,
  });
};
