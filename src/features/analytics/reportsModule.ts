import { Hono } from "hono";
import { prisma } from "@/lib/prisma.js";
import { validateInput } from "@/lib/validateInput.js";
import { reportsQuerySchema } from "@/schema/analyticsSchema.js";

const app = new Hono();

const now = () => new Date();
const subHours = (d: Date, h: number) =>
  new Date(d.getTime() - h * 60 * 60 * 1000);

const buildCsv = (rows: Record<string, any>[]) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => JSON.stringify(r[h] ?? "")).join(","));
  }
  return lines.join("\n");
};

/*
  @route  GET /metrics
  @desc   Returns total searches, total clickouts, clickout rate, and top5 routes for last24h and prev24h
*/
app.get("/metrics", async (c) => {
  // We compute both ranges
  const end = now();
  const startLast24 = subHours(end, 24);
  const startPrev24 = subHours(startLast24, 24);

  const [searchLast, searchPrev, clickLast, clickPrev] = await Promise.all([
    prisma.searchEvent.count({
      where: { createdAt: { gte: startLast24, lt: end } },
    }),
    prisma.searchEvent.count({
      where: { createdAt: { gte: startPrev24, lt: startLast24 } },
    }),
    prisma.clickOutEvent.count({
      where: { createdAt: { gte: startLast24, lt: end } },
    }),
    prisma.clickOutEvent.count({
      where: { createdAt: { gte: startPrev24, lt: startLast24 } },
    }),
  ]);

  const clickRateLast = searchLast ? clickLast / searchLast : 0;
  const clickRatePrev = searchPrev ? clickPrev / searchPrev : 0;

  // Top 5 routes by searches in last 24h
  const topLast = await prisma.searchEvent.groupBy({
    by: ["origin", "destination"],
    _count: { id: true },
    where: { createdAt: { gte: startLast24, lt: end } },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  return c.json({
    last24h: {
      totalSearches: searchLast,
      totalClickOuts: clickLast,
      clickOutRate: clickRateLast,
      topRoutes: topLast.map((r) => ({
        origin: r.origin,
        destination: r.destination,
        count: r._count.id,
      })),
    },
    prev24h: {
      totalSearches: searchPrev,
      totalClickOuts: clickPrev,
      clickOutRate: clickRatePrev,
    },
  });
});

/*
  @route  GET /metrics/timeseries
  @desc   Time-series per hour for last 24h: searches and clickouts
*/
app.get("/metrics/timeseries", async (c) => {
  const end = now();
  const start = subHours(end, 24);

  const [searches, clicks] = await Promise.all([
    prisma.searchEvent.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true },
    }),
    prisma.clickOutEvent.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true },
    }),
  ]);

  const buckets: { label: string; searches: number; clickouts: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const t = subHours(end, i);
    const label = `${t.getHours().toString().padStart(2, "0")}:00`;
    buckets.push({ label, searches: 0, clickouts: 0 });
  }

  const bucketIndex = (d: Date) => {
    const diffMs = end.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / (60 * 60 * 1000));
    const idx = 23 - diffH;
    return idx >= 0 && idx < 24 ? idx : null;
  };

  for (const s of searches) {
    const idx = bucketIndex(s.createdAt);
    if (idx !== null) buckets[idx].searches += 1;
  }
  for (const cl of clicks) {
    const idx = bucketIndex(cl.createdAt);
    if (idx !== null) buckets[idx].clickouts += 1;
  }

  return c.json({ series: buckets });
});

/*
  @route  GET /metrics/breakdown
  @desc   Breakdown by device/browser/os for last 24h
  @query  type=device|browser|os
*/
app.get("/metrics/breakdown", async (c) => {
  const type = (c.req.query("type") || "device") as
    | "device"
    | "browser"
    | "os"
    | "geo";
  const end = now();
  const start = subHours(end, 24);

  let byField: "deviceType" | "browser" | "os" | "country" = "deviceType";
  if (type === "browser") byField = "browser";
  if (type === "os") byField = "os";
  if (type === "geo") byField = "country";

  const rows = await prisma.searchEvent.groupBy({
    by: [byField],
    _count: { id: true },
    where: {
      createdAt: { gte: start, lt: end },
      [byField]: { not: null } as any,
    },
    orderBy: { _count: { id: "desc" } },
    take: 8,
  });

  return c.json({
    breakdown: rows.map((r: any) => ({
      key: (r[byField] as string) ?? "Unknown",
      count: r._count.id,
    })),
  });
});

/*
  @route  GET /top-routes
  @desc   Returns top routes by searches for a given range with optional CSV
*/
app.get("/top-routes", async (c) => {
  const q = await validateInput({
    type: "query",
    schema: reportsQuerySchema,
    data: c.req.query(),
  });
  // Support explicit startDate/endDate if provided; fallback to last24h/prev24h
  const end = q.endDate ? new Date(q.endDate as any) : now();
  const start = q.startDate
    ? new Date(q.startDate as any)
    : q.range === "prev24h"
    ? subHours(end, 48)
    : subHours(end, 24);
  const cutoff =
    q.startDate && q.endDate
      ? end
      : q.range === "prev24h"
      ? subHours(end, 24)
      : end;

  const top = await prisma.searchEvent.groupBy({
    by: ["origin", "destination"],
    _count: { id: true },
    where: { createdAt: { gte: start, lt: cutoff } },
    orderBy: { _count: { id: "desc" } },
    take: q.limit ?? 10,
  });

  const rows = top.map((r) => ({
    origin: r.origin,
    destination: r.destination,
    searches: r._count.id,
  }));

  if ((q.format ?? "json") === "csv") {
    const csv = buildCsv(rows);
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header(
      "Content-Disposition",
      `attachment; filename=top-routes-${q.range ?? "last24h"}.csv`
    );
    return c.body(csv);
  }

  return c.json(rows);
});

/*
  @route  GET /clickout-rate
  @desc   Returns clickout rate for last24h or prev24h
*/
app.get("/clickout-rate", async (c) => {
  const q = await validateInput({
    type: "query",
    schema: reportsQuerySchema,
    data: c.req.query(),
  });
  const end = now();
  const start = q.range === "prev24h" ? subHours(end, 48) : subHours(end, 24);
  const cutoff = q.range === "prev24h" ? subHours(end, 24) : end;

  const [searches, clicks] = await Promise.all([
    prisma.searchEvent.count({
      where: { createdAt: { gte: start, lt: cutoff } },
    }),
    prisma.clickOutEvent.count({
      where: { createdAt: { gte: start, lt: cutoff } },
    }),
  ]);

  const rate = searches ? clicks / searches : 0;

  if ((q.format ?? "json") === "csv") {
    const csv = buildCsv([{ searches, clicks, rate }]);
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header(
      "Content-Disposition",
      `attachment; filename=clickout-rate-${q.range ?? "last24h"}.csv`
    );
    return c.body(csv);
  }

  return c.json({ searches, clicks, rate });
});

/*
  @route  POST /refresh
  @desc   Placeholder to invalidate caches if we add caching later
*/
app.post("/refresh", async (c) => {
  // No server-side cache yet; respond OK for now.
  return c.json({ ok: true });
});

export default app;
