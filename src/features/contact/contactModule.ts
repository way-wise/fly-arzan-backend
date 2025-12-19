
import { Hono } from "hono";
import { sendEmail } from "@/lib/mailer.js";

const app = new Hono();

/**
 * @route POST /api/contact
 * @desc Handle contact form submissions
 * @access Public
 */
app.post("/", async (c) => {
    try {
        const body = await c.req.json();
        const { fullName, email, companyName, phone, message } = body;

        // Basic validation
        if (!fullName || !email || !message) {
            return c.json({ error: "Missing required fields: fullName, email, message" }, 400);
        }

        // Construct email content
        const subject = `New Contact Form Submission from ${fullName}`;
        const html = `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${fullName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Company:</strong> ${companyName || "N/A"}</p>
            <p><strong>Phone:</strong> ${phone || "N/A"}</p>
            <br/>
            <h3>Message:</h3>
            <p style="white-space: pre-wrap;">${message}</p>
        `;

        // Send email to the admin/support email
        // Determine recipient email
        // Priority:
        // 1. CONTACT_EMAIL (Explicit config)
        // 2. SMTP_USER (If it's an email)
        // 3. SMTP_FROM (Extracted email)
        // 4. Default fallback (noreply@flyarzan.com)

        let recipientEmail = process.env.CONTACT_EMAIL;

        // Validation helper
        const isEmail = (str: string | undefined): str is string => !!str && str.includes("@");

        if (!isEmail(recipientEmail)) {
            const smtpUser = process.env.SMTP_USER;
            if (isEmail(smtpUser)) {
                recipientEmail = smtpUser;
            } else {
                // Try to extract from SMTP_FROM
                const smtpFrom = process.env.SMTP_FROM || "";
                if (isEmail(smtpFrom)) {
                    // Try matching <email> first
                    const match = smtpFrom.match(/<([^>]+)>/);
                    if (match && match[1]) {
                        recipientEmail = match[1];
                    } else {
                        // Assume the whole thing might be an email or contains one
                        // Simple cleanup if it doesn't have brackets but has @
                        recipientEmail = smtpFrom.trim();
                    }
                }
            }
        }

        // Final fallback if everything fails, to prevent crash
        if (!isEmail(recipientEmail)) {
            console.warn("Could not determine recipient email from env. Defaulting to noreply@flyarzan.com. Set CONTACT_EMAIL in .env to fix.");
            recipientEmail = "noreply@flyarzan.com";
        }

        const result = await sendEmail({
            to: recipientEmail as string,
            subject,
            html,
            // Reply-To ensures that when you click reply, it goes to the user who filled the form
            replyTo: email,
            // The 'from' address must remain the authenticated SMTP user to pass spam filters
            from: process.env.SMTP_FROM
        });

        if (!result.success) {
            console.error("Failed to send contact email:", result.error);
            return c.json({ error: `Failed to send message: ${result.error}` }, 500);
        }

        return c.json({ success: true, message: "Message sent successfully" });

    } catch (error) {
        console.error("Error in contact form submission:", error);
        return c.json({ error: "Internal server error" }, 500);
    }
});

export default app;
