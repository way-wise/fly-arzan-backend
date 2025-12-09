import { auth, requireAuth } from "@/lib/auth.js";
import { validateInput } from "@/lib/validateInput.js";
import { signInSchema, signUpSchema } from "@/schema/authSchema.js";
import { Hono } from "hono";

const app = new Hono();

/*
  @route    POST: /sign-in
  @access   public
  @desc     Sign in with email and password
*/
app.post("/sign-in", async (c) => {
  // Validate form
  const validatedForm = await validateInput({
    type: "form",
    schema: signInSchema,
    data: await c.req.parseBody(),
  });

  // Parse rememberMe from form data (default to true per better-auth)
  const formData = await c.req.parseBody();
  const rememberMe = formData.rememberMe !== "false"; // Default true unless explicitly "false"

  // Use better-auth's signInEmail with headers to get cookies
  const response = await auth.api.signInEmail({
    body: {
      email: validatedForm.email,
      password: validatedForm.password,
      rememberMe, // Pass rememberMe option to better-auth
    },
    asResponse: true,
    headers: c.req.raw.headers,
  });

  // Get the JSON body
  const data = await response.json();

  // If better-auth returned an error, pass it through with proper status
  if (!response.ok) {
    return c.json(data, response.status as 400 | 401 | 403 | 404 | 500);
  }

  // Copy cookies from better-auth response to our response (only on success)
  const cookies = response.headers.getSetCookie();
  for (const cookie of cookies) {
    c.header("Set-Cookie", cookie, { append: true });
  }

  return c.json(data);
});

/*
  @route    POST: /sign-up
  @access   public
  @desc     Sign Up with email and password
*/
app.post("/sign-up", async (c) => {
  // Validate form
  const validatedForm = await validateInput({
    type: "form",
    schema: signUpSchema,
    data: await c.req.parseBody(),
  });

  const response = await auth.api.signUpEmail({
    body: {
      name: validatedForm.name,
      email: validatedForm.email,
      password: validatedForm.password,
    },
    asResponse: true,
    headers: c.req.raw.headers,
  });

  // Copy cookies from better-auth response to our response
  const cookies = response.headers.getSetCookie();
  for (const cookie of cookies) {
    c.header("Set-Cookie", cookie, { append: true });
  }

  // Get the JSON body
  const data = await response.json();

  return c.json(data);
});

/*
  @route    POST: /change-password
  @access   private
  @desc     Change user password
*/
app.post("/change-password", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { currentPassword, newPassword } = body;

    // Simple validation
    if (!currentPassword) {
      return c.json({ message: "Current password is required" }, 400);
    }
    if (!newPassword || newPassword.length < 8) {
      return c.json(
        { message: "New password must be at least 8 characters" },
        400
      );
    }

    // Use better-auth's changePassword API
    const response = await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
      },
      asResponse: true,
      headers: c.req.raw.headers,
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { message?: string };
      return c.json(
        { message: errorData.message || "Failed to change password" },
        400
      );
    }

    return c.json({ message: "Password changed successfully" });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to change password";
    return c.json({ message: errorMessage }, 500);
  }
});

export default app;
