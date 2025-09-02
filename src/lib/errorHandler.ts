import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

// App Validation Error Class
export class AppValidationError extends Error {
  type: "form" | "query" | "param";
  message: string;
  path?: string;

  constructor(
    type: "form" | "query" | "param",
    message: string,
    path?: string,
  ) {
    super(message);
    this.name = "AppValidationError";
    this.type = type;
    this.message = message;
    if (path) this.path = path;
  }
}

// Global Error Handler
export const errorHandler: ErrorHandler = (err, c) => {
  const isProduction = process.env.NODE_ENV === "production";

  // Custom Validation Error
  if (err instanceof AppValidationError) {
    const error = {
      validationError: {
        type: err.type,
        message: err.message,
        ...(err.type === "form" && err.path ? { path: err.path } : {}),
      },
    };

    return c.json(error, 400);
  }

  // HTTP Exception
  if (err instanceof HTTPException) {
    return (
      err.res ??
      c.json(
        {
          message: err.message,
        },
        err.status,
      )
    );
  }

  // Other Exception
  return c.json(
    {
      message: isProduction ? "Internal Server Error" : err.message,
      stack: isProduction ? undefined : err.stack,
    },
    500,
  );
};