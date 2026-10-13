/**
 * Chat sidebar menu (used by LayoutMenuData → VerticalLayouts).
 *
 * Master is dynamic:
 * - SoftOnCloud PRIME / ADMIN / *_ADMIN → may see Master
 * - Employee / other roles → Master hidden
 * - Child items still filtered by tab_role_permission (can_view + is_active)
 * No hardcoded "Employee" checks.
 */

const section = (label) => ({ isHeader: true, label });

const link = (id, label, icon, route, badge) => ({
  id,
  label,
  icon,
  link: route,
  ...(badge || {}),
});

const messagesBadgeFrom = (messagesUnread) => {
  const total = Math.max(0, Number(messagesUnread) || 0);
  return total > 0
    ? {
        badge: true,
        badgeColor: "danger",
        badgeName: total > 99 ? "99+" : String(total),
      }
    : {};
};

const groupsBadgeFrom = (groupsUnread) => {
  const total = Math.max(0, Number(groupsUnread) || 0);
  return total > 0
    ? {
        badge: true,
        badgeColor: "danger",
        badgeName: total > 99 ? "99+" : String(total),
      }
    : {};
};

const MASTER_CHILD_CODES = new Set([
  "CHAT_MANAGE_USERS",
  "CHAT_MANAGE_ROLES",
  "CHAT_MANAGE_PERMS",
]);

const defaultMasterChildren = () => [
  link(
    "master-manage-users",
    "Manage Users",
    "ri-user-settings-line",
    "/communication/master/manage-users"
  ),
  link(
    "master-manage-roles",
    "Manage Roles",
    "ri-shield-user-line",
    "/communication/master/manage-roles"
  ),
  link(
    "master-manage-permissions",
    "Manage Permissions",
    "ri-lock-2-line",
    "/communication/master/manage-permissions"
  ),
];

/** Clickable Master parent with nested links (Velzon Collapse / subItems). */
const masterDropdown = (subItems, options = {}) => {
  if (!subItems?.length) return null;
  return {
    id: "master",
    label: "Master",
    icon: "ri-folders-line",
    link: "/#",
    stateVariables: Boolean(options.isMasterOpen),
    click: (e) => {
      e.preventDefault();
      if (typeof options.onToggleMaster === "function") {
        options.onToggleMaster();
      }
    },
    subItems,
  };
};

const isMasterChildTab = (tab) => {
  const code = String(tab.tabCode || "").toUpperCase();
  if (MASTER_CHILD_CODES.has(code)) return true;
  if (String(tab.sectionCode || "").toUpperCase() === "MASTER" && tab.routePath) {
    return code !== "CHAT_MASTER";
  }
  return false;
};

/** SoftOnCloud prime/admin (or *_ADMIN role) — dynamic, not an "Employee" string check. */
export const canShowMasterMenu = (options = {}) =>
  options.showMaster === true;

/** Build sidebar from DB permission/menu rows. */
export const buildMenuFromPermissions = (permissionMenu = [], options = {}) => {
  const items = [];
  const messagesBadge = messagesBadgeFrom(options.messagesUnread);
  const groupsBadge = groupsBadgeFrom(options.groupsUnread);
  const masterChildren = [];
  const allowMaster = canShowMasterMenu(options);

  const visible = (permissionMenu || [])
    .filter((t) => t && (t.canView || t.view) && (t.isActive || t.active))
    .filter((t) => String(t.tabCode || "").toUpperCase() !== "CHAT_LOGOUT")
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  if (!visible.length) return null;

  let lastSection = null;

  for (const tab of visible) {
    const code = String(tab.tabCode || "").toUpperCase();

    // SoftOnCloud eligibility gate (Prime/Admin per org setting)
    if (
      code === "CHAT_AUC" &&
      options.showAllUserCommunication !== true
    ) {
      continue;
    }

    // Master parent / children — only for SoftOnCloud admin/prime
    if (code === "CHAT_MASTER" || (!tab.routePath && tab.sectionCode === "MASTER")) {
      continue;
    }

    if (isMasterChildTab(tab)) {
      if (allowMaster) {
        masterChildren.push(
          link(
            `perm-tab-${tab.tabId}`,
            tab.tabName || tab.tab || tab.tabCode || `Tab ${tab.tabId}`,
            tab.iconClass || "ri-menu-line",
            String(tab.routePath)
          )
        );
      }
      continue;
    }

    if (!tab.routePath) continue;

    const sec = String(tab.sectionCode || "").toUpperCase();
    if (sec && sec !== lastSection && sec !== "MASTER") {
      items.push(section(sec === "CHAT" ? "Chat" : sec));
      lastSection = sec;
    }

    const path = String(tab.routePath);
    let badge = {};
    if (path.includes("/messages")) badge = messagesBadge;
    if (path.includes("/groups")) badge = groupsBadge;

    items.push(
      link(
        `perm-tab-${tab.tabId}`,
        tab.tabName || tab.tab || tab.tabCode || `Tab ${tab.tabId}`,
        tab.iconClass || "ri-menu-line",
        path,
        badge
      )
    );
  }

  if (allowMaster) {
    const children =
      masterChildren.length > 0 ? masterChildren : defaultMasterChildren();
    const master = masterDropdown(children, options);
    if (master) items.push(master);
  }

  return items.length ? items : null;
};

export const buildCommunicationMenu = (options = {}) => {
  const dynamic = buildMenuFromPermissions(options.permissionMenu, options);
  if (dynamic) return dynamic;

  const messagesBadge = messagesBadgeFrom(options.messagesUnread);
  const groupsBadge = groupsBadgeFrom(options.groupsUnread);

  const items = [
    section("Chat"),
    link("comm-dashboard", "Dashboard", "ri-dashboard-2-line", "/communication/dashboard"),
    link("comm-inbox", "Messages", "ri-message-3-line", "/communication/messages", messagesBadge),
    link("comm-groups", "Groups", "ri-group-line", "/communication/groups", groupsBadge),
    link("comm-announcements", "Announcements", "ri-megaphone-line", "/communication/announcements"),
    link("comm-settings", "Settings", "ri-settings-3-line", "/communication/settings"),
  ];

  if (options.showAllUserCommunication) {
    items.push(
      link(
        "comm-all-user-communication",
        "All User Communication",
        "ri-mail-send-line",
        "/communication/all-user-communication"
      )
    );
  }

  if (canShowMasterMenu(options)) {
    const master = masterDropdown(defaultMasterChildren(), options);
    if (master) items.push(master);
  }

  return items;
};
