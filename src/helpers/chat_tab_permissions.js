/**
 * Map Manage Permissions tabs → in-app forms.
 * Flags come from tab_role_permission via GET /api/permissions/menu.
 */

export const CHAT_TAB = {
  DASHBOARD: "CHAT_DASHBOARD",
  MESSAGES: "CHAT_MESSAGES",
  GROUPS: "CHAT_GROUPS",
  ANNOUNCEMENTS: "CHAT_ANNOUNCEMENTS",
  SETTINGS: "CHAT_SETTINGS",
  AUC: "CHAT_AUC",
  MASTER: "CHAT_MASTER",
  MANAGE_USERS: "CHAT_MANAGE_USERS",
  MANAGE_ROLES: "CHAT_MANAGE_ROLES",
  MANAGE_PERMS: "CHAT_MANAGE_PERMS",
  /** My Profile uses Settings flags (no separate menu tab). */
  PROFILE: "CHAT_SETTINGS",
};

const emptyFlags = () => ({
  canView: false,
  canAdd: false,
  canEdit: false,
  canDelete: false,
  isActive: false,
});

/** Normalize one permission row into action flags. */
export const flagsFromPermissionRow = (row) => {
  if (!row) return emptyFlags();
  const isActive = Boolean(row.isActive ?? row.active);
  const canView = Boolean(row.canView ?? row.view);
  const canAdd = Boolean(row.canAdd ?? row.add);
  const canEdit = Boolean(row.canEdit ?? row.edit);
  const canDelete = Boolean(row.canDelete ?? row.delete);
  // ACTIVE must be on for ADD / EDIT / DELETE to take effect
  return {
    canView: isActive && canView,
    canAdd: isActive && canAdd,
    canEdit: isActive && canEdit,
    canDelete: isActive && canDelete,
    isActive,
  };
};

export const indexPermissionsByTabCode = (rows = []) => {
  const map = {};
  (rows || []).forEach((row) => {
    const code = String(row.tabCode || row.TabCode || "").toUpperCase();
    if (!code) return;
    map[code] = flagsFromPermissionRow(row);
  });
  return map;
};

export const getFlagsForTab = (byCode, tabCode) => {
  const code = String(tabCode || "").toUpperCase();
  return byCode?.[code] || emptyFlags();
};
