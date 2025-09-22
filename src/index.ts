import "@dotenvx/dotenvx/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import { errorHandler } from "@/lib/errorHandler.js";

import authModule from "@/features/auth/authModule.js";
import locationModule from "@/features/locations/locationModule.js";
import offerModule from "@/features/flight-offers/offerModule.js";

// Hono init
const app = new Hono().basePath("/api");

// Secure headers
app.use(secureHeaders());

// Cors config
app.use(
  cors({
    origin: process.env.APP_CLIENT_URL!,
  })
);

// Routes
app.get("/", (c) => {
  return c.text("The server is healthy and running...!");
});

app.route("/auth", authModule);
app.route("/locations", locationModule);
app.route("/flight-offers", offerModule);

// Not found
app.notFound((c) => {
  return c.json(
    {
      message: `${c.req.path} Not Found`,
    },
    404
  );
});

// Error Handler
app.onError(errorHandler);

// Server
const server = serve(
  {
    fetch: app.fetch,
    port: 8787,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);

// graceful shutdown
process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
});
