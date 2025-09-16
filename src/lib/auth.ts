import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "./prisma.js";
import type { Context } from "hono";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [admin()],
});

// Get the current user session from request headers
export const getSession = async (c: Context) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  return session;
};
