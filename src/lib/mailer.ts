import nodemailer from "nodemailer";

// SMTP Configuration from environment variables
const smtpConfig = {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
};

// Create reusable transporter
const transporter = nodemailer.createTransport(smtpConfig);

// Default sender
const defaultFrom = process.env.SMTP_FROM || "Fly Arzan <noreply@flyarzan.com>";

/**
 * Send a single email
 */
export async function sendEmail({
    to,
    subject,
    html,
    text,
    from = defaultFrom,
}: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    from?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        // Check if SMTP is configured
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn("[Mailer] SMTP not configured, skipping email send");
            return { success: false, error: "SMTP not configured" };
        }

        const info = await transporter.sendMail({
            from,
            to,
            subject,
            text: text || html?.replace(/<[^>]*>/g, ""), // Strip HTML for text version
            html,
        });

        console.log(`[Mailer] Email sent to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Mailer] Failed to send email to ${to}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
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
    results: { userId: string; email: string; success: boolean; error?: string }[];
}> {
    const results: { userId: string; email: string; success: boolean; error?: string }[] = [];
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
            results.push({ userId: recipient.userId, email: recipient.email, success: true });
        } else {
            failed++;
            results.push({
                userId: recipient.userId,
                email: recipient.email,
                success: false,
                error: result.error,
            });
        }

        // Small delay between emails to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
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
