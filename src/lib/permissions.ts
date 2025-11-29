import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

/**
 * Permission Statements
 * Define all resources and their available actions
 */
const statement = {
  ...defaultStatements, // Includes default admin permissions (user management, etc.)

  // User Management
  user: [
    "create",
    "list",
    "view",
    "update",
    "delete",
    "ban",
    "unban",
    "set-role",
    "set-password",
    "impersonate",
  ],
  session: ["list", "revoke", "revoke-all"],

  // Role & Permission Management
  role: ["create", "list", "view", "update", "delete"],
  permission: ["list", "view"],

  // CMS Management
  cms: ["create", "list", "view", "update", "delete", "publish"],

  // Analytics
  analytics: ["view", "export"],

  // System
  system: ["dashboard", "settings", "logs"],

  // Feedback
  feedback: ["list", "view", "update", "delete"],
} as const;

/**
 * Create Access Controller
 */
export const ac = createAccessControl(statement);

/**
 * Super Admin Role - Has ALL permissions
 * This role cannot be modified or deleted
 */
export const superAdmin = ac.newRole({
  ...adminAc.statements,
  user: [
    "create",
    "list",
    "view",
    "update",
    "delete",
    "ban",
    "unban",
    "set-role",
    "set-password",
    "impersonate",
  ],
  session: ["list", "revoke", "revoke-all"],
  role: ["create", "list", "view", "update", "delete"],
  permission: ["list", "view"],
  cms: ["create", "list", "view", "update", "delete", "publish"],
  analytics: ["view", "export"],
  system: ["dashboard", "settings", "logs"],
  feedback: ["list", "view", "update", "delete"],
});

/**
 * Admin Role - Has most permissions except system settings
 */
export const admin = ac.newRole({
  ...adminAc.statements,
  user: [
    "create",
    "list",
    "view",
    "update",
    "delete",
    "ban",
    "unban",
    "set-role",
  ],
  session: ["list", "revoke", "revoke-all"],
  role: ["list", "view"],
  permission: ["list", "view"],
  cms: ["create", "list", "view", "update", "delete", "publish"],
  analytics: ["view", "export"],
  system: ["dashboard", "logs"],
  feedback: ["list", "view", "update", "delete"],
});

/**
 * Moderator Role - Content management focused
 */
export const moderator = ac.newRole({
  user: ["list", "view", "ban", "unban"],
  session: ["list"],
  cms: ["list", "view", "update"],
  analytics: ["view"],
  system: ["dashboard"],
  feedback: ["list", "view", "update"],
});

/**
 * User Role - Basic permissions
 */
export const user = ac.newRole({
  system: ["dashboard"],
});

/**
 * Role definitions for better-auth admin plugin
 */
export const roles = {
  super: superAdmin,
  admin,
  moderator,
  user,
};

/**
 * Role metadata for UI display
 */
export const roleMetadata = {
  super: {
    id: "super",
    name: "Super Admin",
    description: "Full access to all features including system settings",
    color: "#DC2626", // red
    isSystem: true,
  },
  admin: {
    id: "admin",
    name: "Administrator",
    description: "Full access to user and content management",
    color: "#F97316", // orange
    isSystem: true,
  },
  moderator: {
    id: "moderator",
    name: "Moderator",
    description: "Content moderation and user management",
    color: "#8B5CF6", // purple
    isSystem: true,
  },
  user: {
    id: "user",
    name: "User",
    description: "Basic access to dashboard",
    color: "#3B82F6", // blue
    isSystem: true,
  },
};

/**
 * Permission categories for UI grouping
 */
export const permissionCategories = {
  user_management: {
    name: "User Management",
    description: "Manage users, sessions, and roles",
    permissions: [
      { resource: "user", action: "create", displayName: "Create User" },
      { resource: "user", action: "list", displayName: "List Users" },
      { resource: "user", action: "view", displayName: "View User Details" },
      { resource: "user", action: "update", displayName: "Update User" },
      { resource: "user", action: "delete", displayName: "Delete User" },
      { resource: "user", action: "ban", displayName: "Ban User" },
      { resource: "user", action: "unban", displayName: "Unban User" },
      { resource: "user", action: "set-role", displayName: "Set User Role" },
      {
        resource: "user",
        action: "set-password",
        displayName: "Set User Password",
      },
      {
        resource: "user",
        action: "impersonate",
        displayName: "Impersonate User",
      },
      { resource: "session", action: "list", displayName: "List Sessions" },
      { resource: "session", action: "revoke", displayName: "Revoke Session" },
      {
        resource: "session",
        action: "revoke-all",
        displayName: "Revoke All Sessions",
      },
    ],
  },
  role_management: {
    name: "Role & Permission Management",
    description: "Manage roles and permissions",
    permissions: [
      { resource: "role", action: "create", displayName: "Create Role" },
      { resource: "role", action: "list", displayName: "List Roles" },
      { resource: "role", action: "view", displayName: "View Role Details" },
      { resource: "role", action: "update", displayName: "Update Role" },
      { resource: "role", action: "delete", displayName: "Delete Role" },
      {
        resource: "permission",
        action: "list",
        displayName: "List Permissions",
      },
      {
        resource: "permission",
        action: "view",
        displayName: "View Permission Details",
      },
    ],
  },
  content_management: {
    name: "Content Management",
    description: "Manage CMS pages and content",
    permissions: [
      { resource: "cms", action: "create", displayName: "Create Content" },
      { resource: "cms", action: "list", displayName: "List Content" },
      { resource: "cms", action: "view", displayName: "View Content" },
      { resource: "cms", action: "update", displayName: "Update Content" },
      { resource: "cms", action: "delete", displayName: "Delete Content" },
      { resource: "cms", action: "publish", displayName: "Publish Content" },
    ],
  },
  analytics: {
    name: "Analytics",
    description: "View and export analytics data",
    permissions: [
      { resource: "analytics", action: "view", displayName: "View Analytics" },
      {
        resource: "analytics",
        action: "export",
        displayName: "Export Analytics",
      },
    ],
  },
  system: {
    name: "System",
    description: "System administration",
    permissions: [
      {
        resource: "system",
        action: "dashboard",
        displayName: "Access Dashboard",
      },
      {
        resource: "system",
        action: "settings",
        displayName: "Manage Settings",
      },
      { resource: "system", action: "logs", displayName: "View System Logs" },
    ],
  },
  feedback: {
    name: "Feedback",
    description: "Manage user feedback",
    permissions: [
      { resource: "feedback", action: "list", displayName: "List Feedback" },
      { resource: "feedback", action: "view", displayName: "View Feedback" },
      {
        resource: "feedback",
        action: "update",
        displayName: "Update Feedback",
      },
      {
        resource: "feedback",
        action: "delete",
        displayName: "Delete Feedback",
      },
    ],
  },
};

/**
 * Get all permissions as flat array
 */
export function getAllPermissions() {
  const permissions: Array<{
    resource: string;
    action: string;
    displayName: string;
    group: string;
  }> = [];

  for (const [groupKey, category] of Object.entries(permissionCategories)) {
    for (const perm of category.permissions) {
      permissions.push({
        ...perm,
        group: groupKey,
      });
    }
  }

  return permissions;
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(
  roleName: keyof typeof roles,
  resource: string,
  action: string
): boolean {
  const role = roles[roleName];
  if (!role) return false;

  // @ts-ignore - accessing role permissions
  const resourcePerms = role.statements?.[resource];
  if (!resourcePerms) return false;

  return resourcePerms.includes(action);
}
