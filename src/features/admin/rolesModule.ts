import { Hono } from "hono";
import { requireAdmin, requirePermission, getSession } from "@/lib/auth.js";
import { prisma } from "@/lib/prisma.js";
import {
  roleMetadata,
  permissionCategories,
  getAllPermissions,
} from "@/lib/permissions.js";
import * as permissionService from "@/lib/permissions-service.js";

const app = new Hono();

/**
 * @route GET /api/admin/roles
 * @desc Get all available roles with their permissions
 * @access Admin only (role:list permission)
 */
app.get("/", requireAdmin, async (c) => {
  try {
    // Get roles from database
    const dbRoles = await prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Merge with metadata
    const roles = dbRoles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      color:
        roleMetadata[role.name as keyof typeof roleMetadata]?.color ||
        "#6B7280",
      displayName:
        roleMetadata[role.name as keyof typeof roleMetadata]?.name || role.name,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        displayName: rp.permission.displayName,
        group: rp.permission.group,
      })),
      permissionCount: role.rolePermissions.length,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));

    return c.json({ roles });
  } catch (error) {
    console.error("Error fetching roles:", error);

    // Fallback to static roles if database not seeded
    const staticRoles = Object.entries(roleMetadata).map(([key, meta]) => ({
      id: key,
      name: key,
      description: meta.description,
      isSystem: meta.isSystem,
      color: meta.color,
      displayName: meta.name,
      permissions: [],
      permissionCount: 0,
    }));

    return c.json({ roles: staticRoles });
  }
});

/**
 * @route GET /api/admin/roles/:roleId
 * @desc Get a specific role with permissions
 * @access Admin only
 */
app.get("/:roleId", requireAdmin, async (c) => {
  const roleId = c.req.param("roleId");

  try {
    const role = await prisma.role.findFirst({
      where: {
        OR: [{ id: roleId }, { name: roleId }],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      // Check static roles
      const staticRole = roleMetadata[roleId as keyof typeof roleMetadata];
      if (staticRole) {
        return c.json({
          ...staticRole,
          id: roleId,
          name: staticRole.name || roleId,
          permissions: [],
        });
      }
      return c.json({ error: "Role not found" }, 404);
    }

    return c.json({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      color:
        roleMetadata[role.name as keyof typeof roleMetadata]?.color ||
        "#6B7280",
      displayName:
        roleMetadata[role.name as keyof typeof roleMetadata]?.name || role.name,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        displayName: rp.permission.displayName,
        group: rp.permission.group,
      })),
    });
  } catch (error) {
    console.error("Error fetching role:", error);
    return c.json({ error: "Failed to fetch role" }, 500);
  }
});

/**
 * @route POST /api/admin/roles
 * @desc Create a new role
 * @access Admin only (role:create permission)
 */
app.post("/", requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, permissionIds = [] } = body;

    if (!name) {
      return c.json({ error: "Role name is required" }, 400);
    }

    // Check if role already exists
    const existing = await prisma.role.findUnique({
      where: { name },
    });

    if (existing) {
      return c.json({ error: "Role already exists" }, 400);
    }

    const role = await permissionService.createRole({
      name,
      description,
      permissionIds,
    });

    return c.json({ role, message: "Role created successfully" }, 201);
  } catch (error) {
    console.error("Error creating role:", error);
    return c.json({ error: "Failed to create role" }, 500);
  }
});

/**
 * @route PUT /api/admin/roles/:roleId
 * @desc Update role permissions
 * @access Admin only (role:update permission)
 */
app.put("/:roleId", requireAdmin, async (c) => {
  const roleId = c.req.param("roleId");

  try {
    const body = await c.req.json();
    const { description, permissionIds } = body;

    const role = await prisma.role.findFirst({
      where: {
        OR: [{ id: roleId }, { name: roleId }],
      },
    });

    if (!role) {
      return c.json({ error: "Role not found" }, 404);
    }

    if (role.isSystem) {
      return c.json({ error: "Cannot modify system role" }, 403);
    }

    // Update description if provided
    if (description !== undefined) {
      await prisma.role.update({
        where: { id: role.id },
        data: { description },
      });
    }

    // Update permissions if provided
    if (permissionIds) {
      await permissionService.updateRolePermissions(role.name, permissionIds);
    }

    const updatedRole = await permissionService.getRoleWithPermissions(
      role.name
    );

    return c.json({ role: updatedRole, message: "Role updated successfully" });
  } catch (error: any) {
    console.error("Error updating role:", error);
    return c.json({ error: error.message || "Failed to update role" }, 500);
  }
});

/**
 * @route DELETE /api/admin/roles/:roleId
 * @desc Delete a role
 * @access Admin only (role:delete permission)
 */
app.delete("/:roleId", requireAdmin, async (c) => {
  const roleId = c.req.param("roleId");

  try {
    const role = await prisma.role.findFirst({
      where: {
        OR: [{ id: roleId }, { name: roleId }],
      },
    });

    if (!role) {
      return c.json({ error: "Role not found" }, 404);
    }

    await permissionService.deleteRole(role.name);

    return c.json({ message: "Role deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting role:", error);
    return c.json({ error: error.message || "Failed to delete role" }, 500);
  }
});

/**
 * @route GET /api/admin/roles/permissions/all
 * @desc Get all available permissions grouped by category
 * @access Admin only
 */
app.get("/permissions/all", requireAdmin, async (c) => {
  try {
    // Try to get from database first
    const dbPermissions = await prisma.permission.findMany({
      orderBy: [{ group: "asc" }, { resource: "asc" }, { action: "asc" }],
    });

    if (dbPermissions.length > 0) {
      // Group by category
      const grouped = dbPermissions.reduce((acc, perm) => {
        if (!acc[perm.group]) {
          acc[perm.group] = {
            name:
              permissionCategories[
                perm.group as keyof typeof permissionCategories
              ]?.name || perm.group,
            description:
              permissionCategories[
                perm.group as keyof typeof permissionCategories
              ]?.description || "",
            permissions: [],
          };
        }
        acc[perm.group].permissions.push(perm);
        return acc;
      }, {} as Record<string, { name: string; description: string; permissions: typeof dbPermissions }>);

      return c.json({ permissions: grouped });
    }

    // Fallback to static permissions
    return c.json({ permissions: permissionCategories });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return c.json({ permissions: permissionCategories });
  }
});

/**
 * @route GET /api/admin/roles/me/permissions
 * @desc Get current user's role and permissions
 * @access Authenticated
 */
app.get("/me/permissions", async (c) => {
  const session = await getSession(c);

  if (!session?.user) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const userRole = session.user.role || "user";

  try {
    // Get permissions from database
    const permissions = await permissionService.getUserPermissions(
      session.user.id
    );
    const permissionsGrouped =
      await permissionService.getUserPermissionsGrouped(session.user.id);

    return c.json({
      userId: session.user.id,
      role: userRole,
      roleDisplayName:
        roleMetadata[userRole as keyof typeof roleMetadata]?.name || userRole,
      permissions,
      permissionsGrouped,
    });
  } catch (error) {
    // Fallback to role-based permissions from static config
    return c.json({
      userId: session.user.id,
      role: userRole,
      roleDisplayName:
        roleMetadata[userRole as keyof typeof roleMetadata]?.name || userRole,
      permissions: [],
      permissionsGrouped: {},
    });
  }
});

export default app;
