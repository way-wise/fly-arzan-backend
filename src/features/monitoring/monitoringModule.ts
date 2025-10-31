import { Hono } from "hono";
import { prisma } from "@/lib/prisma.js";

const app = new Hono();

// Track server start time for uptime
const serverStartTime = Date.now();

// Simple in-memory quota tracking (replace with Redis/DB for production)
let quotaUsage = {
  daily: 0,
  dailyLimit: 1000, // Example limit
  lastReset: new Date().toISOString().split("T")[0], // YYYY-MM-DD
};

// Track last Amadeus API check
let lastAmadeusCheck = {
  status: "unknown" as "healthy" | "degraded" | "down" | "unknown",
  lastChecked: null as Date | null,
  lastError: null as string | null,
};

/*
  @route  GET /health
  @desc   Returns overall system health status
*/
app.get("/health", async (c) => {
  const checks = {
    database: "unknown",
    amadeus: "unknown",
    uptime: 0,
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "healthy";
  } catch (err) {
    checks.database = "down";
  }

  // Use cached Amadeus status (updated by quota tracking or on-demand)
  checks.amadeus = lastAmadeusCheck.status;

  // Calculate uptime in seconds
  checks.uptime = Math.floor((Date.now() - serverStartTime) / 1000);

  // Determine overall status
  let overallStatus: "green" | "yellow" | "red" = "green";
  if (checks.database === "down" || checks.amadeus === "down") {
    overallStatus = "red";
  } else if (checks.amadeus === "degraded" || checks.amadeus === "unknown") {
    overallStatus = "yellow";
  }

  return c.json({
    status: overallStatus,
    checks,
    timestamp: new Date().toISOString(),
  });
});

/*
  @route  GET /quota
  @desc   Returns current API quota usage and thresholds
*/
app.get("/quota", async (c) => {
  // Reset daily counter if new day
  const today = new Date().toISOString().split("T")[0];
  if (quotaUsage.lastReset !== today) {
    quotaUsage.daily = 0;
    quotaUsage.lastReset = today;
  }

  const usagePercent = (quotaUsage.daily / quotaUsage.dailyLimit) * 100;
  let alert: { level: string; message: string } | null = null;

  if (usagePercent >= 100) {
    alert = { level: "critical", message: "API quota limit reached (100%)" };
  } else if (usagePercent >= 80) {
    alert = { level: "warning", message: "API quota at 80% or above" };
  }

  return c.json({
    daily: quotaUsage.daily,
    limit: quotaUsage.dailyLimit,
    percent: Math.round(usagePercent),
    alert,
    lastReset: quotaUsage.lastReset,
  });
});

/*
  @route  POST /quota/increment
  @desc   Internal endpoint to increment quota usage (called by offerService)
*/
app.post("/quota/increment", async (c) => {
  const today = new Date().toISOString().split("T")[0];
  if (quotaUsage.lastReset !== today) {
    quotaUsage.daily = 0;
    quotaUsage.lastReset = today;
  }

  quotaUsage.daily += 1;

  // Check if we crossed thresholds and should trigger alerts
  const usagePercent = (quotaUsage.daily / quotaUsage.dailyLimit) * 100;
  if (usagePercent >= 100 || usagePercent >= 80) {
    // TODO: Trigger alert (email/Slack) - implement in alertService
    console.warn(`[ALERT] API quota at ${Math.round(usagePercent)}%`);
  }

  return c.json({ ok: true, daily: quotaUsage.daily });
});

/*
  @route  POST /amadeus/status
  @desc   Update Amadeus API status (called by offerService on success/failure)
*/
app.post("/amadeus/status", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { status, error } = body;

  lastAmadeusCheck.status = status || "unknown";
  lastAmadeusCheck.lastChecked = new Date();
  lastAmadeusCheck.lastError = error || null;

  // If down for >1 minute, trigger alert
  if (status === "down") {
    // TODO: Implement alert logic with timestamp tracking
    console.error(`[ALERT] Amadeus API is down: ${error}`);
  }

  return c.json({ ok: true });
});

/*
  @route  GET /alerts
  @desc   Returns active alerts (quota, outages)
*/
app.get("/alerts", async (c) => {
  const alerts: any[] = [];

  // Check quota
  const today = new Date().toISOString().split("T")[0];
  if (quotaUsage.lastReset !== today) {
    quotaUsage.daily = 0;
    quotaUsage.lastReset = today;
  }
  const usagePercent = (quotaUsage.daily / quotaUsage.dailyLimit) * 100;

  if (usagePercent >= 100) {
    alerts.push({
      type: "quota",
      level: "critical",
      message: "API quota limit reached (100%)",
      timestamp: new Date().toISOString(),
    });
  } else if (usagePercent >= 80) {
    alerts.push({
      type: "quota",
      level: "warning",
      message: `API quota at ${Math.round(usagePercent)}%`,
      timestamp: new Date().toISOString(),
    });
  }

  // Check Amadeus status
  if (lastAmadeusCheck.status === "down") {
    alerts.push({
      type: "api_outage",
      level: "critical",
      message: "Amadeus API is down",
      error: lastAmadeusCheck.lastError,
      timestamp: lastAmadeusCheck.lastChecked?.toISOString(),
    });
  } else if (lastAmadeusCheck.status === "degraded") {
    alerts.push({
      type: "api_degraded",
      level: "warning",
      message: "Amadeus API performance degraded",
      timestamp: lastAmadeusCheck.lastChecked?.toISOString(),
    });
  }

  return c.json({ alerts, count: alerts.length });
});

export default app;
