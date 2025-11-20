import { Hono } from "hono";
import { validateInput } from "@/lib/validateInput.js";
import {
  searchEventSchema,
  clickOutEventSchema,
} from "@/schema/analyticsSchema.js";
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

// Extract simple cookie value by name from Cookie header
const getCookie = (cookieHeader: string | undefined, name: string) => {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";");
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
};

// Extract UTM parameters from a URL string (e.g., Referer)
const pickUtmFromUrl = (urlStr?: string | null) => {
  try {
    if (!urlStr) return {} as Record<string, string | undefined>;
    const u = new URL(urlStr);
    const q = u.searchParams;
    return {
      utmSource: q.get("utm_source") || undefined,
      utmMedium: q.get("utm_medium") || undefined,
      utmCampaign: q.get("utm_campaign") || undefined,
      utmContent: q.get("utm_content") || undefined,
      utmTerm: q.get("utm_term") || undefined,
    };
  } catch {
    return {} as Record<string, string | undefined>;
  }
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
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0] ||
    (c.req.raw as any).socket?.remoteAddress;

  // Context enrichment
  const cookieHeader = c.req.header("cookie");
  const sessionId =
    (validated as any).sessionId ||
    c.req.header("x-session-id") ||
    getCookie(cookieHeader, "fa_sid");
  const referrer = c.req.header("referer") ?? undefined;
  const utmFromBody = {
    utmSource: (validated as any).utmSource,
    utmMedium: (validated as any).utmMedium,
    utmCampaign: (validated as any).utmCampaign,
    utmContent: (validated as any).utmContent,
    utmTerm: (validated as any).utmTerm,
  };
  const utmFromReferrer = pickUtmFromUrl(referrer);

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
      region: null, // TODO: Add geolocation
      // affiliate context
      sessionId: sessionId,
      referrer: referrer,
      utmSource: utmFromBody.utmSource ?? utmFromReferrer.utmSource,
      utmMedium: utmFromBody.utmMedium ?? utmFromReferrer.utmMedium,
      utmCampaign: utmFromBody.utmCampaign ?? utmFromReferrer.utmCampaign,
      utmContent: utmFromBody.utmContent ?? utmFromReferrer.utmContent,
      utmTerm: utmFromBody.utmTerm ?? utmFromReferrer.utmTerm,
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
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0] ||
    (c.req.raw as any).socket?.remoteAddress;

  const created = await prisma.clickOutEvent.create({
    data: {
      origin: validated.origin,
      destination: validated.destination,
      tripType: validated.tripType,
      partner: validated.partner,
      userAgent: ua,
      ipMasked: maskIp(ip),
      // affiliate context
      sessionId: sessionId,
      requestId: c.get("requestId") as string | undefined,
      referrer: referrer,
      utmSource: (validated as any).utmSource,
      utmMedium: (validated as any).utmMedium,
      utmCampaign: (validated as any).utmCampaign,
      utmContent: (validated as any).utmContent,
      utmTerm: (validated as any).utmTerm,
      price: (validated as any).price ?? undefined,
      currency: (validated as any).currency ?? undefined,
      deepLink: (validated as any).deepLink ?? undefined,
    },
  });

  return c.json({ ok: true, id: created.id });
});

export default app;
