import nodemailer from "nodemailer";

// SMTP Configuration from environment variables
const port = parseInt(process.env.SMTP_PORT || "587");
const smtpConfig = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: port,
  // Force secure=false for port 587 (STARTTLS), force true for 465.
  // Otherwise fallback to env var or false.
  secure:
    port === 465
      ? true
      : port === 587
      ? false
      : process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Create reusable transporter
const transporter = nodemailer.createTransport(smtpConfig);

// Default sender - use SMTP_FROM or fallback to Resend test domain
const defaultFrom =
  process.env.SMTP_FROM || "Fly Arzan <onboarding@resend.dev>";

/**
 * Send a single email
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = defaultFrom,
  replyTo,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("[Mailer] SMTP not configured, skipping email send");
      return { success: false, error: "SMTP not configured" };
    }

    console.log(
      `[Mailer] Attempting to send email to ${to} with subject: "${subject}"`
    );
    console.log(
      `[Mailer] Using SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`
    );

    const info = await transporter.sendMail({
      from,
      to,
      replyTo,
      subject,
      text: text || html?.replace(/<[^>]*>/g, ""), // Strip HTML for text version
      html,
    });

    console.log(
      `[Mailer] ✓ Email sent successfully to ${to}: ${info.messageId}`
    );
    console.log(`[Mailer] Response:`, JSON.stringify(info, null, 2));
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Mailer] ✗ Failed to send email to ${to}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[Mailer] Error details: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send bulk emails (one by one to avoid rate limits)
 */
export async function sendBulkEmails({
  recipients,
  subject,
  html,
  text,
  from = defaultFrom,
}: {
  recipients: { email: string; userId: string }[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}): Promise<{
  sent: number;
  failed: number;
  results: {
    userId: string;
    email: string;
    success: boolean;
    error?: string;
  }[];
}> {
  const results: {
    userId: string;
    email: string;
    success: boolean;
    error?: string;
  }[] = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const result = await sendEmail({
      to: recipient.email,
      subject,
      html,
      text,
      from,
    });

    if (result.success) {
      sent++;
      results.push({
        userId: recipient.userId,
        email: recipient.email,
        success: true,
      });
    } else {
      failed++;
      results.push({
        userId: recipient.userId,
        email: recipient.email,
        success: false,
        error: result.error,
      });
    }

    // Delay between emails to respect Resend rate limits (2 req/sec = 500ms minimum)
    // Using 600ms to be safe and avoid 429 errors
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  return { sent, failed, results };
}

/**
 * Verify SMTP connection
 */
export async function verifySmtpConnection(): Promise<boolean> {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("[Mailer] SMTP not configured");
      return false;
    }
    await transporter.verify();
    console.log("[Mailer] SMTP connection verified");
    return true;
  } catch (error) {
    console.error("[Mailer] SMTP connection failed:", error);
    return false;
  }
}

export { transporter };
