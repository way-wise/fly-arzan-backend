import nodemailer from "nodemailer";

// Create transporter - configure based on your email service
const port = parseInt(process.env.SMTP_PORT || "587");
const transporter = nodemailer.createTransport({
  // For custom SMTP:
  host: process.env.SMTP_HOST,
  port: port,
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
});

const APP_NAME = "Fly Arzan";
const APP_URL = process.env.APP_CLIENT_URL || "http://localhost:5173";
const defaultFrom =
  process.env.SMTP_FROM || `${APP_NAME} <onboarding@resend.dev>`;

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  url: string
) {
  try {
    console.log(`[Email] Attempting to send password reset email to ${to}`);
    console.log(
      `[Email] Using SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`
    );

    const info = await transporter.sendMail({
      from: defaultFrom,
      to,
      subject: "Reset Your Password - Fly Arzan",
      text: `Reset your password by visiting: ${url}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 40px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">${APP_NAME}</h1>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 40px 40px 30px 40px; text-align: center;">
                      <h2 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #333333; line-height: 1.3;">Reset Your Password</h2>
                      <p style="margin: 0 auto 20px auto; font-size: 16px; line-height: 1.6; color: #666666; max-width: 80%;">
                        We received a request to reset your password. Click the button below to set a new password. This link will expire in 1 hour.
                      </p>

                      <!-- CTA Button -->
                      <table role="presentation" style="margin: 30px auto;">
                        <tr>
                          <td>
                            <a href="${url}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; letter-spacing: 0.3px;">Reset Password</a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 30px auto 0 auto; font-size: 14px; line-height: 1.6; color: #999999; max-width: 80%;">
                        If the button doesn't work, copy and paste this URL into your browser:
                      </p>
                      <p style="margin: 10px auto 0 auto; padding: 12px; background-color: #f5f5f5; border-radius: 4px; font-size: 12px; word-break: break-all; color: #666666; text-align: center; max-width: 90%;">
                        ${url}
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
                      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #999999;">
                        If you didn't request this password reset, you can safely ignore this email.
                      </p>
                      <p style="margin: 15px 0 0 0; font-size: 13px; line-height: 1.6; color: #999999;">
                        &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
    console.log(
      `[Email] ✓ Password reset email sent to ${to}:`,
      info.messageId
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(
      `[Email] ✗ Failed to send password reset email to ${to}:`,
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[Email] Error details: ${errorMessage}`);
    throw error;
  }
}

export async function sendVerificationEmail(
  to: string,
  token: string,
  url: string
) {
  try {
    await transporter.sendMail({
      from: defaultFrom,
      to,
      subject: "Verify Your Email - Fly Arzan",
      text: `Verify your email by visiting: ${url}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 40px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">${APP_NAME}</h1>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 40px 40px 30px 40px; text-align: center;">
                      <h2 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #333333; line-height: 1.3;">Verify Your Email</h2>
                      <p style="margin: 0 auto 20px auto; font-size: 16px; line-height: 1.6; color: #666666; max-width: 80%;">
                        Thanks for signing up! Please verify your email address by clicking the button below.
                      </p>

                      <!-- CTA Button -->
                      <table role="presentation" style="margin: 30px auto;">
                        <tr>
                          <td>
                            <a href="${url}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; letter-spacing: 0.3px;">Verify Email</a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 30px auto 0 auto; font-size: 14px; line-height: 1.6; color: #999999; max-width: 80%;">
                        If the button doesn't work, copy and paste this URL into your browser:
                      </p>
                      <p style="margin: 10px auto 0 auto; padding: 12px; background-color: #f5f5f5; border-radius: 4px; font-size: 12px; word-break: break-all; color: #666666; text-align: center; max-width: 90%;">
                        ${url}
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
                      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #999999;">
                        If you didn't create an account, you can safely ignore this email.
                      </p>
                      <p style="margin: 15px 0 0 0; font-size: 13px; line-height: 1.6; color: #999999;">
                        &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
    console.log(`[Email] Verification email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error(`[Email] Failed to send verification email to ${to}:`, error);
    throw error;
  }
}
