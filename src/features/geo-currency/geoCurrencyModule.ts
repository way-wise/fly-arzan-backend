import { Hono } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";

const app = new Hono();

/*
  @route    GET: /geo-currency
  @access   public
  @desc     Get geo location and currency
*/
app.get("/", async (c) => {
  const forwardedFor = c.req.header("x-forwarded-for");
  const conn = getConnInfo(c);

  const ip = forwardedFor
    ? forwardedFor.split(",")[0].trim()
    : conn.remote.address;

  return c.json({ ip });
});

export default app;
