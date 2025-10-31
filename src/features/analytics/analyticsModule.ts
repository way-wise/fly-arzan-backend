import { Hono } from "hono";
import { validateInput } from "@/lib/validateInput.js";
import { searchEventSchema, clickOutEventSchema } from "@/schema/analyticsSchema.js";
import { prisma } from "@/lib/prisma.js";
import { parseUserAgent } from "@/lib/deviceParser.js";

const app = new Hono();

// Helper to mask IPv4/IPv6 rudimentarily
const maskIp = (ip?: string | null) => {
  if (!ip) return undefined;
  // Remove IPv6 prefix if present
  const cleaned = ip.replace("::ffff:", "");
  if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.0.0`;
  }
  // Basic IPv6 mask
  if (cleaned.includes(":")) {
    const segs = cleaned.split(":");
    return `${segs.slice(0, 2).join(":")}::`;
  }
  return undefined;
};

/*
  @route   POST /search
  @access  public (to be protected later)
  @desc    Ingest a search event
*/
app.post("/search", async (c) => {
  const validated = await validateInput({
    type: "form",
    schema: searchEventSchema,
    data: (await c.req.json().catch(() => ({}))) as unknown,
  });

  const ua = c.req.header("user-agent") ?? undefined;
  const ip = c.req.header("x-forwarded-for")?.split(",")[0] || (c.req.raw as any).socket?.remoteAddress;

  // Parse device info from user agent
  const deviceInfo = ua ? parseUserAgent(ua) : null;

  // TODO: Add IP geolocation lookup here (e.g., using ipapi.co or MaxMind)
  // For now, we'll leave country/region as null

  const created = await prisma.searchEvent.create({
    data: {
      origin: validated.origin,
      destination: validated.destination,
      tripType: validated.tripType,
      travelClass: validated.travelClass,
      adults: validated.adults ?? 1,
      children: validated.children ?? 0,
      browser: deviceInfo?.browser,
      browserVersion: deviceInfo?.browserVersion,
      os: deviceInfo?.os,
      osVersion: deviceInfo?.osVersion,
      deviceType: deviceInfo?.deviceType,
      userAgent: ua,
      ipMasked: maskIp(ip),
      country: null, // TODO: Add geolocation
      region: null,  // TODO: Add geolocation
    },
  });

  return c.json({ ok: true, id: created.id });
});

/*
  @route   POST /clickout
  @access  public (to be protected later)
  @desc    Ingest a click-out event
*/
app.post("/clickout", async (c) => {
  const validated = await validateInput({
    type: "form",
    schema: clickOutEventSchema,
    data: (await c.req.json().catch(() => ({}))) as unknown,
  });

  const ua = c.req.header("user-agent") ?? undefined;
  const ip = c.req.header("x-forwarded-for")?.split(",")[0] || (c.req.raw as any).socket?.remoteAddress;

  const created = await prisma.clickOutEvent.create({
    data: {
      origin: validated.origin,
      destination: validated.destination,
      tripType: validated.tripType,
      partner: validated.partner,
      userAgent: ua,
      ipMasked: maskIp(ip),
    },
  });

  return c.json({ ok: true, id: created.id });
});

export default app;
