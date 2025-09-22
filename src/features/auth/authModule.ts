import { auth } from "@/lib/auth.js";
import { validateInput } from "@/lib/validateInput.js";
import { signInSchema, signUpSchema } from "@/schema/authSchema.js";
import { Hono } from "hono";

const app = new Hono();

/*
  @route    GET: /sign-in
  @access   public
  @desc     Sign in
*/
app.post("/sign-in", async (c) => {
  // Validate form
  const validatedForm = await validateInput({
    type: "form",
    schema: signInSchema,
    data: await c.req.parseBody(),
  });

  const response = await auth.api.signInEmail({
    body: {
      email: validatedForm.email,
      password: validatedForm.password,
    },
  });

  return c.json(response);
});

/*
  @route    GET: /sign-up
  @access   public
  @desc     Sign Up
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
  });

  return c.json(response);
});

export default app;
