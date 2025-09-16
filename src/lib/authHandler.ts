import type { Context, Next } from "hono";
import { getSession } from "@/lib/auth.js";

export const requiresAuth = async (c: Context, next: Next) => {
  const session = await getSession(c);

  if (!session) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  return next();
};
