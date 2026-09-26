export const buildCommunicationMenu = (options = {}) => {
  const section = (label) => ({ isHeader: true, label });
  const link = (id, label, icon, route, badge) => ({
    id,
    label,
    icon,
    link: route,
    ...(badge || {}),
  });

  const messagesTotal = Math.max(0, Number(options.messagesUnread) || 0);
  const messagesBadge =
    messagesTotal > 0
      ? {
          badge: true,
          badgeColor: "danger",
          badgeName: messagesTotal > 99 ? "99+" : String(messagesTotal),
        }
      : {};

  const groupsTotal = Math.max(0, Number(options.groupsUnread) || 0);
  const groupsBadge =
    groupsTotal > 0
      ? {
          badge: true,
          badgeColor: "danger",
          badgeName: groupsTotal > 99 ? "99+" : String(groupsTotal),
        }
      : {};

  return [
    section("Chat"),
    link("comm-dashboard", "Dashboard", "ri-dashboard-2-line", "/communication/dashboard"),
    link(
      "comm-inbox",
      "Messages",
      "ri-message-3-line",
      "/communication/messages",
      messagesBadge
    ),
    link(
      "comm-groups",
      "Groups",
      "ri-group-line",
      "/communication/groups",
      groupsBadge
    ),
    link("comm-announcements", "Announcements", "ri-megaphone-line", "/communication/announcements"),
    link("comm-settings", "Settings", "ri-settings-3-line", "/communication/settings"),
  ];
};
