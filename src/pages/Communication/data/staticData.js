export const currentUser = {
  name: "John Doe",
  role: "Manager - Sales",
  email: "john.doe@softoncloud.com",
  status: "Online",
  avatar: null,
  initials: "JD",
};

export const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "ri-dashboard-2-line", path: "/communication/dashboard", badge: null },
  { id: "inbox", label: "Inbox", icon: "ri-inbox-line", path: "/communication/inbox", badge: 24, badgeColor: "danger" },
  { id: "sent", label: "Sent Items", icon: "ri-send-plane-line", path: "/communication/sent", badge: null },
  { id: "groups", label: "Groups", icon: "ri-group-line", path: "/communication/groups", badge: null },
  { id: "announcements", label: "Announcements", icon: "ri-megaphone-line", path: "/communication/announcements", badge: null },
  { id: "search", label: "Search", icon: "ri-search-line", path: "/communication/inbox", badge: null },
  { id: "starred", label: "Starred", icon: "ri-star-line", path: "/communication/inbox", badge: null },
  { id: "drafts", label: "Drafts", icon: "ri-draft-line", path: "/communication/compose", badge: 5, badgeColor: "secondary" },
  { id: "archive", label: "Archive", icon: "ri-archive-line", path: "/communication/inbox", badge: null },
  { id: "management", label: "Management Dashboard", icon: "ri-bar-chart-box-line", path: "/communication/management", badge: null },
  { id: "settings", label: "Settings", icon: "ri-settings-3-line", path: "/communication/settings", badge: null },
];

export const contacts = [
  { id: 1, name: "Michael Smith", role: "Sales Executive", initials: "MS", color: "#4f46e5", status: "online" },
  { id: 2, name: "Sarah Johnson", role: "Sales Executive", initials: "SJ", color: "#0ea5e9", status: "online" },
  { id: 3, name: "David Brown", role: "Sales Manager", initials: "DB", color: "#10b981", status: "away" },
  { id: 4, name: "Emily Davis", role: "Sales Executive", initials: "ED", color: "#f59e0b", status: "online" },
  { id: 5, name: "Lisa Parker", role: "HR Manager", initials: "LP", color: "#ec4899", status: "offline" },
];

export const inboxMessages = [
  { id: 1, sender: "Emily Davis", initials: "ED", color: "#f59e0b", preview: "Please review the sales target report for Q2.", subject: "Please review the sales target report for Q2.", time: "10:30 AM", date: "14 Aug 2025", unread: 2, active: true },
  { id: 2, sender: "Michael Smith", initials: "MS", color: "#4f46e5", preview: "Can we schedule a call to discuss the client proposal?", subject: "Client Proposal Discussion", time: "Yesterday", unread: 0 },
  { id: 3, sender: "Sarah Johnson", initials: "SJ", color: "#0ea5e9", preview: "Updated the monthly sales figures in the shared folder.", subject: "Monthly Sales Figures", time: "Yesterday", unread: 1 },
  { id: 4, sender: "Sales Team", initials: "ST", color: "#2563eb", preview: "Team meeting rescheduled to Friday at 3 PM.", subject: "Team Meeting Update", time: "2 days ago", unread: 0 },
  { id: 5, sender: "David Brown", initials: "DB", color: "#10b981", preview: "Please approve the expense report for last month.", subject: "Expense Report Approval", time: "3 days ago", unread: 0 },
];

export const sentMessages = [
  { id: 1, to: "Sales Team (18)", initials: "ST", color: "#2563eb", subject: "Monthly Sales Update", preview: "Hello Team, Please find the monthly sales update report attached.", time: "Today, 9:15 AM", read: "12/18 Read", status: "completed" },
  { id: 2, to: "Michael Smith", initials: "MS", color: "#4f46e5", subject: "Q2 Target Review", preview: "Hi Michael, please review the attached Q2 targets.", time: "Yesterday", read: "1/1 Read", status: "completed" },
  { id: 3, to: "HR Department", initials: "HR", color: "#10b981", subject: "Leave Request Update", preview: "Please find my updated leave request details.", time: "2 days ago", read: "3/5 Read", status: "pending" },
  { id: 4, to: "Project Alpha", initials: "PA", color: "#8b5cf6", subject: "Project Milestone Update", preview: "The project has reached milestone 3 successfully.", time: "3 days ago", read: "8/12 Read", status: "completed" },
];

export const groups = [
  { id: 1, name: "Sales Team", initials: "ST", color: "#2563eb", members: 18, preview: "Michael: Updated the sales numbers for July.", time: "10:35 AM", unread: 5, active: true },
  { id: 2, name: "Project Alpha", initials: "PA", color: "#8b5cf6", members: 12, preview: "Sarah: The milestone review is scheduled for Friday.", time: "9:20 AM", unread: 3 },
  { id: 3, name: "HR Department", initials: "HR", color: "#10b981", members: 8, preview: "Lisa: Holiday calendar has been updated.", time: "Yesterday", unread: 0 },
  { id: 4, name: "Finance Team", initials: "FT", color: "#f59e0b", members: 10, preview: "David: Budget approval pending for Q3.", time: "Yesterday", unread: 2 },
  { id: 5, name: "IT Support", initials: "IT", color: "#0ea5e9", members: 15, preview: "System maintenance scheduled for this weekend.", time: "2 days ago", unread: 0 },
];

export const groupMessages = [
  { id: 1, sender: "Michael Smith", initials: "MS", color: "#4f46e5", message: "Good morning team! Please share your weekly sales numbers by EOD.", time: "10:15 AM", isMe: false },
  { id: 2, sender: "Sarah Johnson", initials: "SJ", color: "#0ea5e9", message: "I've uploaded the July numbers to the shared folder.", time: "10:18 AM", isMe: false },
  { id: 3, sender: "John Doe", initials: "JD", color: "#2563eb", message: "Great work everyone! Let's review in tomorrow's standup.", time: "10:27 AM", isMe: true },
  { id: 4, type: "file", sender: "Michael Smith", initials: "MS", color: "#4f46e5", fileName: "Sales_Numbers_July_2025.xlsx", fileSize: "1.25 MB", time: "10:30 AM", isMe: false },
];

export const announcements = [
  { id: 1, title: "Quarterly Business Review Meeting", category: "Organization Wide", type: "Important", preview: "All department heads are requested to attend the QBR meeting on 25 Aug 2025 at 10:00 AM in Conference Room A.", author: "John Doe", role: "CEO", date: "14 Aug 2025, 9:00 AM", read: "245 / 312", status: "Active", pinned: true },
  { id: 2, title: "Independence Day Holiday", category: "HR Department", icon: "ri-calendar-event-line", iconColor: "#10b981", preview: "Office will remain closed on 15 Aug 2025 for Independence Day celebrations.", date: "12 Aug 2025", read: "210 / 312", status: "Active" },
  { id: 3, title: "System Maintenance Schedule", category: "IT Department", icon: "ri-tools-line", iconColor: "#0ea5e9", preview: "Scheduled maintenance on 16 Aug 2025 from 11 PM to 2 AM. Some services may be unavailable.", date: "11 Aug 2025", read: "198 / 312", status: "Expiring Soon" },
  { id: 4, title: "New Expense Policy Update", category: "Finance Department", icon: "ri-money-dollar-circle-line", iconColor: "#f59e0b", preview: "Updated expense reimbursement policy effective from 1 Sep 2025.", date: "10 Aug 2025", read: "156 / 312", status: "Active" },
  { id: 5, title: "Annual Health Check-up Camp", category: "HR Department", icon: "ri-heart-pulse-line", iconColor: "#ec4899", preview: "Free health check-up camp for all employees on 20 Aug 2025.", date: "8 Aug 2025", read: "89 / 312", status: "Expired" },
];

export const dashboardStats = [
  { label: "Unread Messages", value: 24, trend: "+12% from yesterday", icon: "ri-mail-unread-line", color: "primary" },
  { label: "Sent Today", value: 18, trend: "+8% from yesterday", icon: "ri-send-plane-2-line", color: "success" },
  { label: "Online Employees", value: "56 / 120", trend: null, icon: "ri-user-smile-line", color: "info" },
  { label: "Pending Reads", value: 31, trend: "+15% from yesterday", icon: "ri-time-line", color: "warning" },
  { label: "Announcements", value: 7, trend: "2 expiring soon", icon: "ri-megaphone-line", color: "danger" },
  { label: "Drafts", value: 5, trend: "View drafts", icon: "ri-draft-line", color: "secondary" },
];

export const favoriteContacts = [
  { name: "Michael Smith", initials: "MS", color: "#4f46e5", status: "online" },
  { name: "Sarah Johnson", initials: "SJ", color: "#0ea5e9", status: "online" },
  { name: "Emily Davis", initials: "ED", color: "#f59e0b", status: "away" },
  { name: "David Brown", initials: "DB", color: "#10b981", status: "online" },
  { name: "Lisa Parker", initials: "LP", color: "#ec4899", status: "offline" },
];

export const attachments = [
  { name: "Sales_Report_May_2025.xlsx", size: "1.25 MB", type: "excel" },
  { name: "Target_Achievement_Summary.pdf", size: "2.40 MB", type: "pdf" },
];

export const managementStats = [
  { label: "Messages Sent", value: "1,248", trend: "+18%", icon: "ri-send-plane-line", color: "primary" },
  { label: "Messages Read", value: "1,126", trend: "+16%", icon: "ri-mail-check-line", color: "success" },
  { label: "Avg Response Time", value: "4m 28s", trend: "-12%", icon: "ri-timer-line", color: "info" },
  { label: "Active Users", value: 86, trend: "+8%", icon: "ri-user-line", color: "warning" },
  { label: "Pending Replies", value: 32, trend: "-10%", icon: "ri-reply-line", color: "danger" },
  { label: "Communication Score", value: "89/100", trend: "+7%", icon: "ri-award-line", color: "primary" },
];
