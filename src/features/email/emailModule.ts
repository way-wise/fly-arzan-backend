import { Hono } from "hono";
import { prisma } from "@/lib/prisma.js";
import { requireAdmin, auth } from "@/lib/auth.js";
import { sendEmail, sendBulkEmails } from "@/lib/mailer.js";

// Define app with proper types
const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// ============================================
// ADMIN EMAIL CAMPAIGN ENDPOINTS
// ============================================

/**
 * @route POST /api/email/send
 * @desc Send email to a single user (respects preferences)
 * @access Admin only
 */
app.post("/send", requireAdmin, async (c) => {
  const admin = c.get("user");
  const { userId, subject, content } = await c.req.json();

  if (!userId || !subject || !content) {
    return c.json({ error: "userId, subject, and content are required" }, 400);
  }

  // Check if user exists and has newsletter enabled
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      wantsNewsletter: true,
      role: true,
    },
  });

  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  // Only check preferences for customers (role = "user")
  if (targetUser.role === "user" && !targetUser.wantsNewsletter) {
    return c.json(
      { error: "User has disabled newsletter/emails", blocked: true },
      403
    );
  }

  // Create email campaign record
  const campaign = await prisma.emailCampaign.create({
    data: {
      subject,
      content,
      sentById: admin!.id,
      recipientCount: 1,
      status: "sent",
      recipients: {
        create: {
          userId: targetUser.id,
          email: targetUser.email,
          status: "sent",
        },
      },
    },
  });

  // Send actual email via Nodemailer
  const emailResult = await sendEmail({
    to: targetUser.email,
    subject,
    html: content,
  });

  // Update recipient status based on email result
  if (!emailResult.success) {
    await prisma.emailCampaignRecipient.updateMany({
      where: { campaignId: campaign.id, userId: targetUser.id },
      data: { status: "failed" },
    });
  }

  return c.json({
    success: emailResult.success,
    campaign,
    recipient: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
    },
    emailSent: emailResult.success,
    emailError: emailResult.error,
  });
});

/**
 * @route POST /api/email/send-bulk
 * @desc Send email to multiple users (respects preferences)
 * @access Admin only
 */
app.post("/send-bulk", requireAdmin, async (c) => {
  const admin = c.get("user");
  const { userIds, subject, content } = await c.req.json();

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return c.json({ error: "userIds array is required" }, 400);
  }

  if (!subject || !content) {
    return c.json({ error: "subject and content are required" }, 400);
  }

  // Get users who have newsletter enabled
  const eligibleUsers = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      OR: [
        { role: { not: "user" } }, // Non-customers always receive
        { wantsNewsletter: true }, // Customers with newsletter enabled
      ],
    },
    select: { id: true, email: true, name: true },
  });

  if (eligibleUsers.length === 0) {
    return c.json({
      success: false,
      message: "No eligible users (all have newsletter disabled)",
      sent: 0,
      blocked: userIds.length,
    });
  }

  // Create email campaign record
  const campaign = await prisma.emailCampaign.create({
    data: {
      subject,
      content,
      sentById: admin!.id,
      recipientCount: eligibleUsers.length,
      status: "sent",
      recipients: {
        create: eligibleUsers.map((user) => ({
          userId: user.id,
          email: user.email,
          status: "sent",
        })),
      },
    },
    include: {
      recipients: true,
    },
  });

  // Send actual emails via Nodemailer
  const emailResults = await sendBulkEmails({
    recipients: eligibleUsers.map((user) => ({
      email: user.email,
      userId: user.id,
    })),
    subject,
    html: content,
  });

  // Update failed recipients in database
  for (const result of emailResults.results) {
    if (!result.success) {
      await prisma.emailCampaignRecipient.updateMany({
        where: { campaignId: campaign.id, userId: result.userId },
        data: { status: "failed" },
      });
    }
  }

  return c.json({
    success: true,
    campaign: {
      id: campaign.id,
      subject: campaign.subject,
      recipientCount: campaign.recipientCount,
    },
    sent: emailResults.sent,
    failed: emailResults.failed,
    blocked: userIds.length - eligibleUsers.length,
    recipients: eligibleUsers,
  });
});

/**
 * @route POST /api/email/send-to-all-subscribers
 * @desc Send email to all newsletter subscribers
 * @access Admin only
 */
app.post("/send-to-all-subscribers", requireAdmin, async (c) => {
  const admin = c.get("user");
  const { subject, content } = await c.req.json();

  if (!subject || !content) {
    return c.json({ error: "subject and content are required" }, 400);
  }

  // Get all users who have newsletter enabled (customers only)
  const subscribers = await prisma.user.findMany({
    where: {
      role: "user",
      wantsNewsletter: true,
    },
    select: { id: true, email: true, name: true },
  });

  if (subscribers.length === 0) {
    return c.json({
      success: false,
      message: "No newsletter subscribers found",
      sent: 0,
    });
  }

  // Create email campaign record
  const campaign = await prisma.emailCampaign.create({
    data: {
      subject,
      content,
      sentById: admin!.id,
      recipientCount: subscribers.length,
      status: "sent",
      recipients: {
        create: subscribers.map((user) => ({
          userId: user.id,
          email: user.email,
          status: "sent",
        })),
      },
    },
  });

  // Send actual emails via Nodemailer
  const emailResults = await sendBulkEmails({
    recipients: subscribers.map((user) => ({
      email: user.email,
      userId: user.id,
    })),
    subject,
    html: content,
  });

  // Update failed recipients in database
  for (const result of emailResults.results) {
    if (!result.success) {
      await prisma.emailCampaignRecipient.updateMany({
        where: { campaignId: campaign.id, userId: result.userId },
        data: { status: "failed" },
      });
    }
  }

  return c.json({
    success: true,
    campaign: {
      id: campaign.id,
      subject: campaign.subject,
      recipientCount: campaign.recipientCount,
    },
    sent: emailResults.sent,
    failed: emailResults.failed,
  });
});

/**
 * @route GET /api/email/campaigns
 * @desc Get all email campaigns with pagination
 * @access Admin only
 */
app.get("/campaigns", requireAdmin, async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = parseInt(c.req.query("offset") || "0");

  const [campaigns, total] = await Promise.all([
    prisma.emailCampaign.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      include: {
        recipients: {
          select: { id: true, status: true, email: true },
        },
      },
    }),
    prisma.emailCampaign.count(),
  ]);

  // Transform campaigns to include sentCount, failedCount, blockedCount
  const transformedCampaigns = campaigns.map((campaign) => {
    const sentCount = campaign.recipients.filter(
      (r) => r.status === "sent"
    ).length;
    const failedCount = campaign.recipients.filter(
      (r) => r.status === "failed"
    ).length;
    const blockedCount = 0; // Blocked users are not included in recipients

    return {
      id: campaign.id,
      subject: campaign.subject,
      content: campaign.content,
      sentById: campaign.sentById,
      recipientCount: campaign.recipientCount,
      status: campaign.status,
      createdAt: campaign.createdAt,
      sentCount,
      failedCount,
      blockedCount,
      recipients: campaign.recipients,
    };
  });

  return c.json({
    campaigns: transformedCampaigns,
    total,
    limit,
    offset,
  });
});

/**
 * @route GET /api/email/campaigns/:id
 * @desc Get a single email campaign with recipients
 * @access Admin only
 */
app.get("/campaigns/:id", requireAdmin, async (c) => {
  const campaignId = c.req.param("id");

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: {
      recipients: {
        orderBy: { sentAt: "desc" },
      },
    },
  });

  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  return c.json(campaign);
});

/**
 * @route GET /api/email/stats
 * @desc Get email campaign statistics
 * @access Admin only
 */
app.get("/stats", requireAdmin, async (c) => {
  const [totalCampaigns, totalRecipients, subscriberCount, totalCustomers] =
    await Promise.all([
      prisma.emailCampaign.count(),
      prisma.emailCampaignRecipient.count(),
      prisma.user.count({ where: { role: "user", wantsNewsletter: true } }),
      prisma.user.count({ where: { role: "user" } }),
    ]);

  // Unsubscribed = total customers - subscribers
  const unsubscribedCount = totalCustomers - subscriberCount;

  return c.json({
    totalCampaigns,
    totalRecipients,
    subscriberCount,
    unsubscribedCount,
  });
});

/**
 * @route GET /api/email/check-eligibility/:userId
 * @desc Check if a user can receive emails
 * @access Admin only
 */
app.get("/check-eligibility/:userId", requireAdmin, async (c) => {
  const userId = c.req.param("userId");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, wantsNewsletter: true, role: true },
  });

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const canReceiveEmail = user.role !== "user" || user.wantsNewsletter;

  return c.json({
    userId: user.id,
    email: user.email,
    canReceiveEmail,
    reason: canReceiveEmail ? null : "User has disabled newsletter/emails",
  });
});

export default app;
