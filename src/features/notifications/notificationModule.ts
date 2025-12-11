import { Hono } from "hono";
import { prisma } from "@/lib/prisma.js";
import { requireAuth, requireAdmin, auth } from "@/lib/auth.js";
import { sendToUser, sendToUsers } from "@/lib/websocket.js";

// Define app with proper types
const app = new Hono<{
    Variables: {
        user: typeof auth.$Infer.Session.user | null;
        session: typeof auth.$Infer.Session.session | null;
    };
}>();

// ============================================
// USER ENDPOINTS (for logged-in users)
// ============================================

/**
 * @route GET /api/notifications
 * @desc Get current user's notifications with pagination
 * @access Private (authenticated users)
 */
app.get("/", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");
    const unreadOnly = c.req.query("unreadOnly") === "true";

    const where = {
        userId: user.id,
        ...(unreadOnly && { read: false }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { createdAt: "desc" },
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId: user.id, read: false } }),
    ]);

    return c.json({
        notifications,
        total,
        unreadCount,
        limit,
        offset,
    });
});

/**
 * @route GET /api/notifications/unread-count
 * @desc Get unread notification count for current user
 * @access Private
 */
app.get("/unread-count", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const count = await prisma.notification.count({
        where: { userId: user.id, read: false },
    });

    return c.json({ count });
});

/**
 * @route PUT /api/notifications/:id/read
 * @desc Mark a notification as read
 * @access Private
 */
app.put("/:id/read", requireAuth, async (c) => {
    const user = c.get("user");
    const notificationId = c.req.param("id");

    if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    // Verify notification belongs to user
    const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId: user.id },
    });

    if (!notification) {
        return c.json({ error: "Notification not found" }, 404);
    }

    const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true },
    });

    return c.json(updated);
});

/**
 * @route PUT /api/notifications/mark-all-read
 * @desc Mark all notifications as read for current user
 * @access Private
 */
app.put("/mark-all-read", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
    });

    return c.json({ success: true });
});

/**
 * @route DELETE /api/notifications/:id
 * @desc Delete a notification
 * @access Private
 */
app.delete("/:id", requireAuth, async (c) => {
    const user = c.get("user");
    const notificationId = c.req.param("id");

    if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    // Verify notification belongs to user
    const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId: user.id },
    });

    if (!notification) {
        return c.json({ error: "Notification not found" }, 404);
    }

    await prisma.notification.delete({
        where: { id: notificationId },
    });

    return c.json({ success: true });
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * @route POST /api/notifications/admin/send
 * @desc Send notification to a single user (respects preferences)
 * @access Admin only
 */
app.post("/admin/send", requireAdmin, async (c) => {
    const { userId, title, message, type = "info" } = await c.req.json();

    if (!userId || !title || !message) {
        return c.json({ error: "userId, title, and message are required" }, 400);
    }

    // Check if user exists and has notifications enabled
    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, wantsNotifications: true, role: true },
    });

    if (!targetUser) {
        return c.json({ error: "User not found" }, 404);
    }

    // Only check preferences for customers (role = "user")
    if (targetUser.role === "user" && !targetUser.wantsNotifications) {
        return c.json(
            { error: "User has disabled notifications", blocked: true },
            403
        );
    }

    const notification = await prisma.notification.create({
        data: {
            userId,
            title,
            message,
            type,
        },
    });

    // Send real-time notification via WebSocket
    sendToUser(userId, {
        type: "notification",
        payload: notification,
    });

    return c.json({ success: true, notification });
});

/**
 * @route POST /api/notifications/admin/send-bulk
 * @desc Send notification to multiple users (respects preferences)
 * @access Admin only
 */
app.post("/admin/send-bulk", requireAdmin, async (c) => {
    const { userIds, title, message, type = "info" } = await c.req.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return c.json({ error: "userIds array is required" }, 400);
    }

    if (!title || !message) {
        return c.json({ error: "title and message are required" }, 400);
    }

    // Get users who have notifications enabled
    const eligibleUsers = await prisma.user.findMany({
        where: {
            id: { in: userIds },
            OR: [
                { role: { not: "user" } }, // Non-customers always receive
                { wantsNotifications: true }, // Customers with notifications enabled
            ],
        },
        select: { id: true },
    });

    const eligibleUserIds = eligibleUsers.map((u) => u.id);

    if (eligibleUserIds.length === 0) {
        return c.json({
            success: false,
            message: "No eligible users (all have notifications disabled)",
            sent: 0,
            blocked: userIds.length,
        });
    }

    // Create notifications for eligible users
    const notifications = await prisma.notification.createMany({
        data: eligibleUserIds.map((userId) => ({
            userId,
            title,
            message,
            type,
        })),
    });

    // Send real-time notifications via WebSocket (fanout)
    sendToUsers(eligibleUserIds, {
        type: "notification",
        payload: { title, message, type },
    });

    return c.json({
        success: true,
        sent: notifications.count,
        blocked: userIds.length - eligibleUserIds.length,
    });
});

/**
 * @route GET /api/notifications/admin/all
 * @desc Get all notifications (admin view)
 * @access Admin only
 */
app.get("/admin/all", requireAdmin, async (c) => {
    const limit = parseInt(c.req.query("limit") || "50");
    const offset = parseInt(c.req.query("offset") || "0");

    const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
            take: limit,
            skip: offset,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
        }),
        prisma.notification.count(),
    ]);

    return c.json({
        notifications,
        total,
        limit,
        offset,
    });
});

export default app;
