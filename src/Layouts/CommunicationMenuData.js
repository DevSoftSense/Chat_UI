export const buildCommunicationMenu = () => {
  const section = (label) => ({ isHeader: true, label });
  const link = (id, label, icon, route, badge) => ({
    id,
    label,
    icon,
    link: route,
    ...(badge || {}),
  });

  return [
    section("Chat"),
    link("comm-dashboard", "Dashboard", "ri-dashboard-2-line", "/communication/dashboard"),
    link("comm-inbox", "Inbox", "ri-inbox-line", "/communication/inbox", {
      badge: true,
      badgeColor: "danger",
      badgeName: "24",
    }),
    link("comm-compose", "Compose", "ri-edit-box-line", "/communication/compose"),
    link("comm-sent", "Sent Items", "ri-send-plane-line", "/communication/sent"),
    link("comm-groups", "Groups", "ri-group-line", "/communication/groups"),
    link("comm-announcements", "Announcements", "ri-megaphone-line", "/communication/announcements"),
    link("comm-management", "Management Dashboard", "ri-bar-chart-box-line", "/communication/management"),
    link("comm-settings", "Settings", "ri-settings-3-line", "/communication/settings"),
  ];
};
