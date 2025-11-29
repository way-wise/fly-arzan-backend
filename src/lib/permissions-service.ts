import { prisma } from "./prisma.js";

/**
 * Dynamic Permission Service
 *
 * This service provides runtime permission checking based on database-stored roles and permissions.
 * It integrates with Better Auth's role system (stored in users.role field).
 */

/**
 * Check if a user has specific permissions
 * @param userId - The user ID to check
 * @param permissions - Array of permission strings in format "resource:action"
 * @returns Promise<boolean> - True if user has ALL specified permissions
 */
export async function hasPermission(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user?.role) {
      return false;
    }

    const permissionChecks = permissions.map((perm) => {
      const [resource, action] = perm.split(":");
      if (!resource || !action) {
        throw new Error(
          `Invalid permission format: ${perm}. Use "resource:action" format.`
        );
      }
      return { resource, action };
    });

    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        role: {
          name: user.role,
        },
        permission: {
          OR: permissionChecks.map(({ resource, action }) => ({
            resource,
            action,
          })),
        },
      },
      include: {
        permission: true,
      },
    });

    return rolePermissions.length === permissions.length;
  } catch (error) {
    console.error("Error checking permissions:", error);
    return false;
  }
}

/**
 * Check if a user has ANY of the specified permissions (OR logic)
 */
export async function hasAnyPermission(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user?.role) {
      return false;
    }

    const permissionChecks = permissions.map((perm) => {
      const [resource, action] = perm.split(":");
      return { resource, action };
    });

    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        role: {
          name: user.role,
        },
        permission: {
          OR: permissionChecks.map(({ resource, action }) => ({
            resource,
            action,
          })),
        },
      },
    });

    return !!rolePermission;
  } catch (error) {
    console.error("Error checking permissions:", error);
    return false;
  }
}

/**
 * Get all permissions for a user based on their role
 */
export async function getUserPermissions(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user?.role) {
      return [];
    }

    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        role: {
          name: user.role,
        },
      },
      include: {
        permission: {
          select: {
            resource: true,
            action: true,
            displayName: true,
            group: true,
          },
        },
      },
    });

    return rolePermissions.map((rp) => rp.permission);
  } catch (error) {
    console.error("Error getting permissions:", error);
    return [];
  }
}

/**
 * Get all permissions grouped by resource
 */
export async function getUserPermissionsGrouped(userId: string) {
  const permissions = await getUserPermissions(userId);

  return permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm.action);
    return acc;
  }, {} as Record<string, string[]>);
}

/**
 * Get role with all its permissions
 */
export async function getRoleWithPermissions(roleName: string) {
  return await prisma.role.findUnique({
    where: { name: roleName },
    include: {
      rolePermissions: {
        include: {
          permission: true,
        },
      },
    },
  });
}

/**
 * Get all roles
 */
export async function getAllRoles() {
  return await prisma.role.findMany({
    include: {
      rolePermissions: {
        include: {
          permission: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });
}

/**
 * Get all permissions
 */
export async function getAllPermissions() {
  return await prisma.permission.findMany({
    orderBy: [{ group: "asc" }, { resource: "asc" }, { action: "asc" }],
  });
}

/**
 * Get all permissions grouped by group (for UI)
 */
export async function getAllPermissionsGrouped() {
  const permissions = await getAllPermissions();

  return permissions.reduce((acc, perm) => {
    if (!acc[perm.group]) {
      acc[perm.group] = [];
    }
    acc[perm.group].push(perm);
    return acc;
  }, {} as Record<string, typeof permissions>);
}

/**
 * Create a new role
 */
export async function createRole(data: {
  name: string;
  description?: string;
  permissionIds: string[];
}) {
  return await prisma.role.create({
    data: {
      name: data.name,
      description: data.description,
      rolePermissions: {
        create: data.permissionIds.map((permissionId) => ({
          permissionId,
        })),
      },
    },
    include: {
      rolePermissions: {
        include: {
          permission: true,
        },
      },
    },
  });
}

/**
 * Update role permissions
 */
export async function updateRolePermissions(
  roleName: string,
  permissionIds: string[]
) {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role ${roleName} not found`);
  }

  if (role.isSystem) {
    throw new Error(`Cannot modify system role: ${roleName}`);
  }

  // Delete existing permissions and create new ones
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    }),
    prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId: role.id,
        permissionId,
      })),
    }),
  ]);

  return getRoleWithPermissions(roleName);
}

/**
 * Delete a role (only if not a system role)
 */
export async function deleteRole(roleName: string) {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role ${roleName} not found`);
  }

  if (role.isSystem) {
    throw new Error(`Cannot delete system role: ${roleName}`);
  }

  // Check if any users have this role
  const usersWithRole = await prisma.user.count({
    where: { role: roleName },
  });

  if (usersWithRole > 0) {
    throw new Error(
      `Cannot delete role ${roleName}: ${usersWithRole} users have this role`
    );
  }

  await prisma.role.delete({
    where: { name: roleName },
  });
}

/**
 * Assign role to user
 */
export async function assignRole(userId: string, roleName: string) {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role ${roleName} not found`);
  }

  return await prisma.user.update({
    where: { id: userId },
    data: { role: roleName },
  });
}
