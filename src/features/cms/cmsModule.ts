import { Hono } from "hono";
import { prisma } from "@/lib/prisma.js";

const app = new Hono();

// ============================================
// PUBLIC ENDPOINTS (no auth required)
// ============================================

// Get published page by slug (PUBLIC - for frontend pages)
app.get("/public/:slug", async (c) => {
  const slug = c.req.param("slug");
  const page = await prisma.cmsPage.findFirst({
    where: {
      slug,
      status: "published",
    },
    select: {
      slug: true,
      title: true,
      content: true,
      updatedAt: true,
    },
  });
  if (!page) return c.json({ message: "Page not found" }, 404);
  return c.json(page);
});

// ============================================
// ADMIN ENDPOINTS (auth required via /admin/cms mount)
// ============================================

// List all CMS pages (slugs and titles)
app.get("/pages", async (c) => {
  const pages = await prisma.cmsPage.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      updatedAt: true,
    },
    orderBy: { slug: "asc" },
  });
  return c.json(pages);
});

// Get single page by slug
app.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const page = await prisma.cmsPage.findUnique({ where: { slug } });
  if (!page) return c.json({ message: "Not found" }, 404);
  return c.json(page);
});

// Upsert page by slug
app.put("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json();
  const { title, content, status = "published", updatedBy } = body ?? {};
  if (!title || typeof title !== "string") {
    return c.json({ message: "title is required" }, 400);
  }
  // content can be any JSON serializable structure
  const saved = await prisma.cmsPage.upsert({
    where: { slug },
    update: { title, content, status, updatedBy },
    create: { slug, title, content, status, updatedBy },
  });
  return c.json(saved);
});

// Seed default pages if missing
app.post("/seed-defaults", async (c) => {
  const defaults: Array<{ slug: string; title: string; content: any }> = [
    { slug: "about_us", title: "About Us", content: { sections: [] } },
    { slug: "faq", title: "FAQ", content: { items: [] } },
    {
      slug: "privacy_policy",
      title: "Privacy Policy",
      content: { blocks: [] },
    },
    {
      slug: "contact",
      title: "Contact",
      content: { address: {}, channels: [] },
    },
    {
      slug: "visa_requirements",
      title: "Visa Requirements",
      content: { countries: [] },
    },
  ];
  for (const d of defaults) {
    await prisma.cmsPage.upsert({
      where: { slug: d.slug },
      update: {},
      create: { slug: d.slug, title: d.title, content: d.content },
    });
  }
  return c.json({ ok: true });
});

export default app;
