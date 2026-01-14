import { Hono } from "hono";
import { auth, requireAdmin, getSession } from "@/lib/auth.js";
import { prisma } from "@/lib/prisma.js";

const app = new Hono();

/**
 * @route GET /api/admin/users
 * @desc List all users with pagination
 * @access Admin only
 */
app.get("/", requireAdmin, async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = parseInt(c.req.query("offset") || "0");
  const searchValue = c.req.query("searchValue") || "";
  const searchField = c.req.query("searchField") || "email";

  // Show all users including admins, but exclude super admin for security
  // Note: Only ONE super admin should exist in the system
  const baseWhere = {
    role: { not: "super" },
  };

  const where = searchValue
    ? {
      ...baseWhere,
      [searchField]: {
        contains: searchValue,
        mode: "insensitive" as const,
      },
    }
    : baseWhere;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        banned: true,
        banReason: true,
        banExpires: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return c.json({
    users,
    total,
    limit,
    offset,
  });
});

/**
 * @route GET /api/admin/users/:userId
 * @desc Get a single user by ID
 * @access Admin only
 */
app.get("/:userId", requireAdmin, async (c) => {
  const userId = c.req.param("userId");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      banned: true,
      banReason: true,
      banExpires: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(user);
});

/**
 * @route POST /api/admin/users/:userId/set-role
 * @desc Set user role
 * @access Admin only
 */
app.post("/:userId/set-role", requireAdmin, async (c) => {
  const userId = c.req.param("userId");
  const { role } = await c.req.json();

  if (!role) {
    return c.json({ error: "Role is required" }, 400);
  }

  // Prevent assigning super admin role entirely
  if (role === "super") {
    return c.json({ 
      error: "Super admin role cannot be assigned. This role is reserved for system initialization only." 
    }, 403);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return c.json({ success: true, user });
});

/**
 * @route POST /api/admin/users/:userId/ban
 * @desc Ban a user
 * @access Admin only
 */
app.post("/:userId/ban", requireAdmin, async (c) => {
  const userId = c.req.param("userId");
  const { banReason, banExpiresIn } = await c.req.json();

  const banExpires = banExpiresIn
    ? Math.floor(Date.now() / 1000) + banExpiresIn
    : null;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      banned: true,
      banReason: banReason || "No reason provided",
      banExpires,
    },
  });

  // Revoke all sessions for this user
  await prisma.session.deleteMany({
    where: { userId },
  });

  return c.json({ success: true, user: { id: user.id, banned: user.banned } });
});

/**
 * @route POST /api/admin/users/:userId/unban
 * @desc Unban a user
 * @access Admin only
 */
app.post("/:userId/unban", requireAdmin, async (c) => {
  const userId = c.req.param("userId");

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      banned: false,
      banReason: null,
      banExpires: null,
    },
  });

  return c.json({ success: true, user: { id: user.id, banned: user.banned } });
});

/**
 * @route GET /api/admin/users/:userId/sessions
 * @desc Get user sessions
 * @access Admin only
 */
app.get("/:userId/sessions", requireAdmin, async (c) => {
  const userId = c.req.param("userId");

  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ sessions });
});

/**
 * @route DELETE /api/admin/users/:userId/sessions/:sessionId
 * @desc Revoke a specific session
 * @access Admin only
 */
app.delete("/:userId/sessions/:sessionId", requireAdmin, async (c) => {
  const sessionId = c.req.param("sessionId");

  await prisma.session.delete({
    where: { id: sessionId },
  });

  return c.json({ success: true });
});

/**
 * @route DELETE /api/admin/users/:userId/sessions
 * @desc Revoke all sessions for a user
 * @access Admin only
 */
app.delete("/:userId/sessions", requireAdmin, async (c) => {
  const userId = c.req.param("userId");

  await prisma.session.deleteMany({
    where: { userId },
  });

  return c.json({ success: true });
});

/**
 * @route DELETE /api/admin/users/:userId
 * @desc Delete a user
 * @access Admin only
 */
app.delete("/:userId", requireAdmin, async (c) => {
  const userId = c.req.param("userId");

  // Delete user (sessions and accounts will cascade)
  await prisma.user.delete({
    where: { id: userId },
  });

  return c.json({ success: true });
});

export default app;
