import { Hono } from "hono";
import { prisma } from "@/lib/prisma.js";
import { requireAuth, auth } from "@/lib/auth.js";

// Define app with proper types
const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

/**
 * @route   GET /api/user/profile
 * @desc    Get current user profile
 * @access  Private
 */
app.get("/profile", requireAuth, async (c) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }

  // Get user from database with full details
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!dbUser) {
    return c.json({ message: "User not found" }, 404);
  }

  return c.json(dbUser);
});

/**
 * @route   PUT /api/user/profile
 * @desc    Update current user profile
 * @access  Private
 */
app.put("/profile", requireAuth, async (c) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }

  const body = await c.req.json();
  const { name, email } = body;

  // Validate input
  if (!name && !email) {
    return c.json({ message: "No fields to update" }, 400);
  }

  // Check if email is already taken by another user
  if (email && email !== user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser && existingUser.id !== user.id) {
      return c.json({ message: "Email is already in use" }, 400);
    }
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name && { name }),
      ...(email && {
        email,
        emailVerified: email !== user.email ? false : undefined,
      }),
      updatedAt: new Date(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return c.json(updatedUser);
});

export default app;
