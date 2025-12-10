import { Hono } from "hono";
import { requireAdmin } from "@/lib/auth.js";
import { prisma } from "@/lib/prisma.js";

const app = new Hono();

/**
 * @route GET /api/admin/customers
 * @desc List all customers (users with role="user") with pagination
 * @access Admin only
 */
app.get("/", requireAdmin, async (c) => {
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");
    const searchValue = c.req.query("searchValue") || "";
    const searchField = c.req.query("searchField") || "email";

    // Base filter: only customers (role = "user")
    const baseWhere = { role: "user" };

    const where = searchValue
        ? {
            ...baseWhere,
            [searchField]: {
                contains: searchValue,
                mode: "insensitive" as const,
            },
        }
        : baseWhere;

    const [customers, total] = await Promise.all([
        prisma.user.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                email: true,
                emailVerified: true,
                image: true,
                banned: true,
                wantsNotifications: true,
                wantsNewsletter: true,
                communicationPreferencesUpdatedAt: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
        prisma.user.count({ where }),
    ]);

    return c.json({
        customers,
        total,
        limit,
        offset,
    });
});

/**
 * @route GET /api/admin/customers/:customerId
 * @desc Get a single customer by ID
 * @access Admin only
 */
app.get("/:customerId", requireAdmin, async (c) => {
    const customerId = c.req.param("customerId");

    const customer = await prisma.user.findFirst({
        where: {
            id: customerId,
            role: "user", // Ensure we only get customers
        },
        select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            image: true,
            banned: true,
            banReason: true,
            banExpires: true,
            wantsNotifications: true,
            wantsNewsletter: true,
            communicationPreferencesUpdatedAt: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    if (!customer) {
        return c.json({ error: "Customer not found" }, 404);
    }

    return c.json(customer);
});

/**
 * @route PUT /api/admin/customers/:customerId/preferences
 * @desc Update customer communication preferences (admin override)
 * @access Admin only
 */
app.put("/:customerId/preferences", requireAdmin, async (c) => {
    const customerId = c.req.param("customerId");
    const { wantsNotifications, wantsNewsletter } = await c.req.json();

    // Verify customer exists and is a customer (role = "user")
    const existingCustomer = await prisma.user.findFirst({
        where: { id: customerId, role: "user" },
    });

    if (!existingCustomer) {
        return c.json({ error: "Customer not found" }, 404);
    }

    const customer = await prisma.user.update({
        where: { id: customerId },
        data: {
            ...(typeof wantsNotifications === "boolean" && { wantsNotifications }),
            ...(typeof wantsNewsletter === "boolean" && { wantsNewsletter }),
            communicationPreferencesUpdatedAt: new Date(),
        },
        select: {
            id: true,
            name: true,
            email: true,
            wantsNotifications: true,
            wantsNewsletter: true,
            communicationPreferencesUpdatedAt: true,
        },
    });

    return c.json({ success: true, customer });
});

/**
 * @route POST /api/admin/customers/:customerId/ban
 * @desc Ban a customer
 * @access Admin only
 */
app.post("/:customerId/ban", requireAdmin, async (c) => {
    const customerId = c.req.param("customerId");
    const { banReason, banExpiresIn } = await c.req.json();

    // Verify customer exists and is a customer (role = "user")
    const existingCustomer = await prisma.user.findFirst({
        where: { id: customerId, role: "user" },
    });

    if (!existingCustomer) {
        return c.json({ error: "Customer not found" }, 404);
    }

    const banExpires = banExpiresIn
        ? Math.floor(Date.now() / 1000) + banExpiresIn
        : null;

    const customer = await prisma.user.update({
        where: { id: customerId },
        data: {
            banned: true,
            banReason: banReason || "No reason provided",
            banExpires,
        },
    });

    // Revoke all sessions for this customer
    await prisma.session.deleteMany({
        where: { userId: customerId },
    });

    return c.json({ success: true, customer: { id: customer.id, banned: customer.banned } });
});

/**
 * @route POST /api/admin/customers/:customerId/unban
 * @desc Unban a customer
 * @access Admin only
 */
app.post("/:customerId/unban", requireAdmin, async (c) => {
    const customerId = c.req.param("customerId");

    // Verify customer exists and is a customer (role = "user")
    const existingCustomer = await prisma.user.findFirst({
        where: { id: customerId, role: "user" },
    });

    if (!existingCustomer) {
        return c.json({ error: "Customer not found" }, 404);
    }

    const customer = await prisma.user.update({
        where: { id: customerId },
        data: {
            banned: false,
            banReason: null,
            banExpires: null,
        },
    });

    return c.json({ success: true, customer: { id: customer.id, banned: customer.banned } });
});

/**
 * @route DELETE /api/admin/customers/:customerId
 * @desc Delete a customer
 * @access Admin only
 */
app.delete("/:customerId", requireAdmin, async (c) => {
    const customerId = c.req.param("customerId");

    // Verify customer exists and is a customer (role = "user")
    const existingCustomer = await prisma.user.findFirst({
        where: { id: customerId, role: "user" },
    });

    if (!existingCustomer) {
        return c.json({ error: "Customer not found" }, 404);
    }

    // Delete customer (sessions and accounts will cascade)
    await prisma.user.delete({
        where: { id: customerId },
    });

    return c.json({ success: true });
});

/**
 * @route GET /api/admin/customers/stats/overview
 * @desc Get customer statistics overview
 * @access Admin only
 */
app.get("/stats/overview", requireAdmin, async (c) => {
    const [
        totalCustomers,
        verifiedCustomers,
        bannedCustomers,
        wantsNotifications,
        wantsNewsletter,
        newThisMonth,
    ] = await Promise.all([
        prisma.user.count({ where: { role: "user" } }),
        prisma.user.count({ where: { role: "user", emailVerified: true } }),
        prisma.user.count({ where: { role: "user", banned: true } }),
        prisma.user.count({ where: { role: "user", wantsNotifications: true } }),
        prisma.user.count({ where: { role: "user", wantsNewsletter: true } }),
        prisma.user.count({
            where: {
                role: "user",
                createdAt: {
                    gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                },
            },
        }),
    ]);

    return c.json({
        totalCustomers,
        verifiedCustomers,
        bannedCustomers,
        wantsNotifications,
        wantsNewsletter,
        newThisMonth,
    });
});

export default app;
