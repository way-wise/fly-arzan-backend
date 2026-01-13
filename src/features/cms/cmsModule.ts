import { Hono } from "hono";
import type { Context } from "hono";
import { prisma } from "@/lib/prisma.js";
import { requireAdmin } from "@/lib/auth.js";

const app = new Hono();

// ============================================
// PUBLIC ENDPOINTS (no auth required)
// ============================================

// Get published page by slug (PUBLIC - for frontend pages)
app.get("/public/:slug", async (c: Context) => {
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
app.get("/pages", requireAdmin, async (c: Context) => {
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
app.get("/:slug", requireAdmin, async (c: Context) => {
  const slug = c.req.param("slug");
  const page = await prisma.cmsPage.findUnique({ where: { slug } });
  if (!page) return c.json({ message: "Not found" }, 404);
  return c.json(page);
});

// Upsert page by slug
app.put("/:slug", requireAdmin, async (c: Context) => {
  const slug = c.req.param("slug");
  const body = await c.req.json();
  const { title, content, status = "published", updatedBy } = body as {
    title?: string;
    content?: any;
    status?: string;
    updatedBy?: string;
  };
  
  if (!title || typeof title !== "string") {
    return c.json({ message: "title is required" }, 400);
  }
  
  // Get current user for audit trail
  const user = c.get("user");
  const actualUpdatedBy = updatedBy || user?.email || "system";
  
  // content can be any JSON serializable structure
  try {
    const saved = await prisma.cmsPage.upsert({
      where: { slug },
      update: { 
        title, 
        content: content as any, 
        status, 
        updatedBy: actualUpdatedBy 
      },
      create: { 
        slug, 
        title, 
        content: content as any, 
        status, 
        updatedBy: actualUpdatedBy 
      },
    });
    return c.json(saved);
  } catch (error) {
    console.error("CMS upsert error:", error);
    return c.json({ 
      message: "Failed to save page", 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, 500);
  }
});

// Seed default pages if missing
app.post("/seed-defaults", requireAdmin, async (c: Context) => {
  const defaults: Array<{ slug: string; title: string; content: Record<string, any> }> = [
    { slug: "about_us", title: "About Us", content: { sections: [] } },
    { slug: "faq", title: "FAQ", content: { items: [] } },
    {
      slug: "privacy_policy",
      title: "Privacy Policy",
      content: { blocks: [] },
    },
    {
      slug: "terms_and_conditions",
      title: "Terms & Conditions",
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
    {
      slug: "covid_19_info",
      title: "COVID-19 Travel Information",
      content: {
        hero: { title: "", subtitle: "" },
        introduction: "",
        guidelines: [],
        travelRestrictions: "",
        healthRequirements: "",
        lastUpdated: new Date().toISOString(),
      },
    },
    {
      slug: "airport_info",
      title: "Airport Information",
      content: {
        hero: { title: "", subtitle: "" },
        introduction: "",
        sections: [],
        tips: [],
      },
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
