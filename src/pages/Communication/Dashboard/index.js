import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Modal,
  ModalBody,
  ModalHeader,
  Row,
  Spinner,
} from "reactstrap";
import ReactApexChart from "react-apexcharts";
import CountUp from "react-countup";
import Flatpickr from "react-flatpickr";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import CommAvatar, { getCommAvatarSrc } from "../components/CommAvatar";
import {
  countComposerDrafts,
  COMPOSER_DRAFTS_EVENT,
  listComposerDrafts,
} from "../Messages/MessageAttachments";
import {
  getChatDashboard,
  getConfiguredProductId,
  getOrganisationProductUsers,
  getSessionPublicOrgId,
  getSessionUserIdentity,
  getCachedChatUserStatuses,
  markAnnouncementRead,
  publishChatUserStatus,
  resolveChatAttachmentUrl,
  resolveUserAvatarUrl,
  subscribeChatPresence,
} from "../../../helpers/softoncloud_auth_helper";
import {
  resolveAnnouncementStatus,
  statusBadgeClass,
} from "../Announcements/utils/announcementUtils";

const STAT_THEME = {
  "Unread Messages": { bgcolor: "primary", icon: "ri-mail-unread-line" },
  "Sent Today": { bgcolor: "success", icon: "ri-send-plane-2-line" },
  "Online Employees": { bgcolor: "info", icon: "ri-user-smile-line" },
  Announcements: { bgcolor: "danger", icon: "ri-megaphone-line" },
  Drafts: { bgcolor: "secondary", icon: "ri-draft-line" },
};

const CHART_COLORS = ["#405189", "#0ab39c", "#f7b84b", "#f06548", "#878a99", "#299cdb", "#f672a7"];

/** Same avatar fields as Messages chat list. */
const pickUserAvatar = (user) =>
  user?.profileImageUrl ||
  user?.ProfileImageUrl ||
  user?.profile_image_url ||
  user?.avatarUrl ||
  user?.AvatarUrl ||
  user?.profileImage ||
  user?.ProfileImage ||
  user?.photoUrl ||
  user?.PhotoUrl ||
  user?.imageUrl ||
  user?.ImageUrl ||
  null;

const formatDashboardTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { day: "2-digit", month: "short" });
};

const firstName = (fullName) => {
  const name = String(fullName || "").trim();
  if (!name) return "there";
  return name.split(/\s+/)[0];
};

const resolvePhoto = (url) => {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  return resolveChatAttachmentUrl(raw) || raw;
};

const EmptyBlock = ({ message }) => (
  <div className="text-center text-muted py-4 fs-13">{message}</div>
);

const previewText = (text, max = 80) => {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

const announcementCategoryIcon = (name = "") => {
  const n = String(name).toLowerCase();
  if (n.includes("hr"))
    return { icon: "ri-calendar-event-line", color: "#0ab39c" };
  if (n.includes("finance"))
    return { icon: "ri-briefcase-line", color: "#f7b84b" };
  if (n.includes("it"))
    return { icon: "ri-macbook-line", color: "#405189" };
  if (n.includes("ops") || n.includes("operation"))
    return { icon: "ri-settings-3-line", color: "#3577f1" };
  return { icon: "ri-megaphone-line", color: "#405189" };
};

const Dashboard = () => {
  document.title = "Dashboard | Chat Module | SoftOnCloud";
  const location = useLocation();
  const navigate = useNavigate();

  const sessionIdentity = useMemo(() => getSessionUserIdentity(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  /** SoftOnCloud org product users (same API as Messages) — NOT tab_employee_master. */
  const [orgUsers, setOrgUsers] = useState([]);
  const [orgUserIds, setOrgUserIds] = useState(() => new Set());
  const [totalOrgUsers, setTotalOrgUsers] = useState(0);
  const [onlineModalOpen, setOnlineModalOpen] = useState(false);
  const [unreadModalOpen, setUnreadModalOpen] = useState(false);
  const [sentTodayModalOpen, setSentTodayModalOpen] = useState(false);
  const [announcementsModalOpen, setAnnouncementsModalOpen] = useState(false);
  const [draftsModalOpen, setDraftsModalOpen] = useState(false);
  const [composerDraftCount, setComposerDraftCount] = useState(() =>
    countComposerDrafts()
  );
  const [composerDraftRows, setComposerDraftRows] = useState(() =>
    listComposerDrafts()
  );
  const [statusSaving, setStatusSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState("Online");
  const [peerStatuses, setPeerStatuses] = useState(() => getCachedChatUserStatuses());
  const [analyticsPeriod, setAnalyticsPeriod] = useState("week"); // week | month | year
  const [dashboardDate, setDashboardDate] = useState(() => new Date());
  const datePickerRef = useRef(null);
  const hasLoadedOnceRef = React.useRef(false);

  useEffect(() => {
    const refreshDrafts = () => {
      setComposerDraftCount(countComposerDrafts());
      setComposerDraftRows(listComposerDrafts());
    };
    refreshDrafts();
    window.addEventListener(COMPOSER_DRAFTS_EVENT, refreshDrafts);
    window.addEventListener("storage", refreshDrafts);
    return () => {
      window.removeEventListener(COMPOSER_DRAFTS_EVENT, refreshDrafts);
      window.removeEventListener("storage", refreshDrafts);
    };
  }, []);

  const loadOrgUsers = useCallback(async () => {
    try {
      const orgId = getSessionPublicOrgId();
      const productId = getConfiguredProductId();
      if (!orgId || !productId) {
        setOrgUsers([]);
        setOrgUserIds(new Set());
        setTotalOrgUsers(0);
        return;
      }

      const response = await getOrganisationProductUsers(orgId, productId);
      const rows = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.users)
            ? response.users
            : [];

      const ids = new Set();
      const mapped = [];
      rows.filter(Boolean).forEach((user) => {
        const id = user?.userId ?? user?.UserId;
        if (id == null || String(id).trim() === "") return;
        const idStr = String(id);
        ids.add(idStr);
        const name =
          user.displayName ||
          user.DisplayName ||
          [user.firstName || user.FirstName, user.lastName || user.LastName]
            .filter(Boolean)
            .join(" ") ||
          user.email ||
          user.Email ||
          `User ${idStr}`;
        const photo =
          resolveUserAvatarUrl(idStr, pickUserAvatar(user)) ||
          resolvePhoto(pickUserAvatar(user));
        mapped.push({
          id: idStr,
          name,
          email: user.email || user.Email || "",
          photo,
          department: user.department || user.Department || "",
          jobTitle: user.jobTitle || user.JobTitle || "",
        });
      });

      mapped.sort((a, b) => a.name.localeCompare(b.name));
      setOrgUsers(mapped);
      setOrgUserIds(ids);
      setTotalOrgUsers(ids.size);
    } catch {
      setOrgUsers([]);
      setOrgUserIds(new Set());
      setTotalOrgUsers(0);
    }
  }, []);

  const loadDashboard = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent) || hasLoadedOnceRef.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [response] = await Promise.all([
        getChatDashboard(),
        loadOrgUsers(),
      ]);
      setData(response || null);
      hasLoadedOnceRef.current = true;
      if (silent) setError(null);
    } catch (err) {
      if (!silent) {
        setData(null);
        setError(err?.message || "Failed to load dashboard.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [loadOrgUsers]);

  useEffect(() => {
    if (!String(location.pathname || "").includes("/communication/dashboard")) {
      return undefined;
    }
    loadDashboard({ silent: hasLoadedOnceRef.current });

    // Auto-refresh every 15s while on dashboard (no browser reload)
    const timer = window.setInterval(() => {
      loadDashboard({ silent: true });
    }, 15000);

    return () => window.clearInterval(timer);
  }, [location.key, location.pathname, loadDashboard]);

  // Soft refresh when tab becomes visible again
  useEffect(() => {
    const onFocus = () => loadDashboard({ silent: true });
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadDashboard({ silent: true });
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadDashboard]);

  const markAnnouncementSeen = useCallback(
    async (announcementId, { navigateAfter = false } = {}) => {
      if (announcementId == null || announcementId === "") return;
      try {
        await markAnnouncementRead(announcementId);
      } catch {
        // details page may also mark read
      }
      if (navigateAfter) {
        navigate("/communication/announcements", {
          state: {
            openAnnouncementId: announcementId,
            openTs: Date.now(),
          },
        });
      }
    },
    [navigate]
  );

  useEffect(() => {
    const unsubscribe = subscribeChatPresence((event, payload) => {
      if (event === "OnlineUsers") {
        const list = Array.isArray(payload) ? payload : [];
        setOnlineUserIds(new Set(list.map((id) => String(id))));
        return;
      }
      if (event === "UserOnline") {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.add(String(payload));
          return next;
        });
        return;
      }
      if (event === "UserOffline") {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(String(payload));
          return next;
        });
        return;
      }
      if (event === "UserStatusChanged") {
        const userId = String(payload?.userId ?? payload?.UserId ?? "");
        if (!userId) return;
        const status = String(
          payload?.status ?? payload?.Status ?? "Online"
        ).trim() || "Online";
        setPeerStatuses((prev) => ({
          ...prev,
          [userId]: {
            status,
            statusMessage:
              payload?.statusMessage ?? payload?.StatusMessage ?? "",
          },
        }));
        return;
      }
      if (event === "UserStatuses") {
        setPeerStatuses(getCachedChatUserStatuses());
        return;
      }
      if (event === "AnnouncementChanged" || event === "ReceiveNotification") {
        const type = String(
          payload?.notificationType ?? payload?.NotificationType ?? ""
        ).toUpperCase();
        const refType = String(
          payload?.referenceType ?? payload?.ReferenceType ?? ""
        ).toUpperCase();
        if (
          event === "AnnouncementChanged" ||
          type === "ANNOUNCEMENT" ||
          refType === "ANNOUNCEMENT"
        ) {
          loadDashboard({ silent: true });
        }
      }
    });
    return unsubscribe;
  }, [loadDashboard]);

  const summary = data?.summary || data?.Summary || {};
  const profile = data?.profile || data?.Profile || {};
  const recentMessages = data?.recentMessages || data?.RecentMessages || [];
  const unreadMessageList =
    data?.unreadMessageList || data?.UnreadMessageList || [];
  const recentSent = data?.recentSentMessages || data?.RecentSentMessages || [];
  const sentTodayList = data?.sentTodayList || data?.SentTodayList || [];
  const departments =
    data?.departmentMessageSummary || data?.DepartmentMessageSummary || [];
  const announcements =
    data?.recentAnnouncements || data?.RecentAnnouncements || [];
  const unreadAnnouncementList =
    data?.unreadAnnouncementList || data?.UnreadAnnouncementList || [];
  const unreadAnnouncementCount = Number(
    summary.announcements ?? summary.Announcements ?? 0
  );
  const readUnread =
    data?.readUnreadSummary || data?.ReadUnreadSummary || { read: 0, unread: 0 };
  const weekly = data?.weeklyAnalytics || data?.WeeklyAnalytics || [];
  const weeklyTotals = data?.weeklyTotals || data?.WeeklyTotals || {};
  const monthly = data?.monthlyAnalytics || data?.MonthlyAnalytics || [];
  const monthlyTotals = data?.monthlyTotals || data?.MonthlyTotals || {};
  const yearly = data?.yearlyAnalytics || data?.YearlyAnalytics || [];
  const yearlyTotals = data?.yearlyTotals || data?.YearlyTotals || {};
  const favorites = data?.favoriteContacts || data?.FavoriteContacts || [];

  useEffect(() => {
    const fromApi = profile.status || profile.Status;
    if (fromApi) setProfileStatus(String(fromApi));
  }, [profile.status, profile.Status]);

  // Online = SignalR presence ∩ SoftOnCloud organisation product users API
  const liveOnlineCount = useMemo(() => {
    if (orgUserIds.size === 0) return 0;
    let count = 0;
    onlineUserIds.forEach((id) => {
      if (orgUserIds.has(String(id))) count += 1;
    });
    return count;
  }, [orgUserIds, onlineUserIds]);

  const onlineUsersList = useMemo(
    () =>
      orgUsers
        .filter((u) => onlineUserIds.has(String(u.id)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [orgUsers, onlineUserIds]
  );

  const offlineUsersList = useMemo(
    () =>
      orgUsers
        .filter((u) => !onlineUserIds.has(String(u.id)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [orgUsers, onlineUserIds]
  );

  const orgUserById = useMemo(() => {
    const map = new Map();
    orgUsers.forEach((u) => map.set(String(u.id), u));
    return map;
  }, [orgUsers]);

  const resolvePeerPresence = useCallback(
    (userId) => {
      const id = String(userId || "");
      const row = peerStatuses[id] || {};
      const explicit = String(row.status || row.Status || "").trim();
      if (explicit) return explicit;
      if (onlineUserIds.has(id)) return "Online";
      return "Offline";
    },
    [peerStatuses, onlineUserIds]
  );

  const statusFilteredProfiles = useMemo(() => {
    const want = String(profileStatus || "Online").toLowerCase();
    return orgUsers
      .filter((u) => {
        if (
          sessionIdentity?.userId &&
          String(u.id) === String(sessionIdentity.userId)
        ) {
          return false;
        }
        return resolvePeerPresence(u.id).toLowerCase() === want;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orgUsers, profileStatus, resolvePeerPresence, sessionIdentity?.userId]);

  /** Chat Messages જેવી જ user DP (SoftOnCloud users API + local store). */
  const resolveChatUserDp = useCallback(
    (userId, apiPhotoFallback = null) => {
      if (userId == null || userId === "") {
        return getCommAvatarSrc(1, resolvePhoto(apiPhotoFallback));
      }
      const key = String(userId);
      const fromOrg = orgUserById.get(key);
      // Prefer SoftOnCloud / chat avatar — do not let wrong employee_master photo override.
      if (fromOrg) {
        return getCommAvatarSrc(
          key,
          fromOrg.photo || resolveUserAvatarUrl(key, null)
        );
      }
      return getCommAvatarSrc(
        key,
        resolveUserAvatarUrl(key, null) || resolvePhoto(apiPhotoFallback)
      );
    },
    [orgUserById]
  );

  const resolveChatUserName = useCallback(
    (userId, fallbackName = "") => {
      if (userId == null || userId === "") return fallbackName || "User";
      const fromOrg = orgUserById.get(String(userId));
      return fromOrg?.name || fallbackName || `User ${userId}`;
    },
    [orgUserById]
  );

  const totalEmployees = totalOrgUsers;

  const displayName =
    profile.fullName ||
    profile.FullName ||
    sessionIdentity?.displayName ||
    "User";
  const displayEmail =
    profile.email || profile.Email || sessionIdentity?.email || "";
  const displayRole =
    [profile.role || profile.Role, profile.department || profile.Department]
      .filter(Boolean)
      .join(" · ") ||
    sessionIdentity?.role ||
    sessionIdentity?.jobTitle ||
    "";
  const profilePhoto = resolvePhoto(
    profile.photoUrl || profile.PhotoUrl || sessionIdentity?.profileImage
  );

  const stats = [
    {
      label: "Unread Messages",
      value: Number(summary.unreadMessages ?? summary.UnreadMessages ?? 0),
      action: "unread-popup",
    },
    {
      label: "Sent Today",
      value: Number(summary.sentToday ?? summary.SentToday ?? 0),
      action: "sent-popup",
    },
    {
      label: "Online Employees",
      value: `${liveOnlineCount} / ${totalEmployees}`,
      action: "online-popup",
    },
    {
      label: "Announcements",
      value: unreadAnnouncementCount,
      action: "announcements-popup",
    },
    {
      label: "Drafts",
      value:
        Number(summary.drafts ?? summary.Drafts ?? 0) + composerDraftCount,
      action: "drafts-popup",
    },
  ];

  const deptFromOrg = useMemo(() => {
    const counts = new Map();
    const bump = (userId) => {
      if (userId == null || userId === "") return;
      const u = orgUserById.get(String(userId));
      const dept = String(u?.department || "").trim() || "Other";
      counts.set(dept, (counts.get(dept) || 0) + 1);
    };
    recentMessages.forEach((m) => bump(m.senderUserId ?? m.SenderUserId));
    unreadMessageList.forEach((m) => bump(m.senderUserId ?? m.SenderUserId));
    recentSent.forEach((m) => bump(m.recipientUserId ?? m.RecipientUserId));
    sentTodayList.forEach((m) => bump(m.recipientUserId ?? m.RecipientUserId));
    return Array.from(counts.entries())
      .map(([department, messageCount]) => ({ department, messageCount }))
      .sort((a, b) => b.messageCount - a.messageCount);
  }, [
    orgUserById,
    recentMessages,
    unreadMessageList,
    recentSent,
    sentTodayList,
  ]);

  const deptRows = useMemo(() => {
    const apiOnlyOther =
      departments.length <= 1 &&
      departments.every((d) => {
        const name = String(
          d.department || d.Department || "Other"
        ).toLowerCase();
        return name === "other" || name === "";
      });
    if (apiOnlyOther && deptFromOrg.length) return deptFromOrg;
    if (departments.length) {
      return departments.map((d) => ({
        department: d.department || d.Department || "Other",
        messageCount: Number(d.messageCount ?? d.MessageCount ?? 0),
      }));
    }
    return deptFromOrg;
  }, [departments, deptFromOrg]);

  const deptSeries = deptRows.map((d) => Number(d.messageCount || 0));
  const deptLabels = deptRows.map((d) => d.department || "Other");
  const deptTotal = deptSeries.reduce((s, n) => s + n, 0);

  const deptChart = {
    series: deptSeries.length ? deptSeries : [0],
    options: {
      chart: { type: "donut" },
      labels: deptLabels.length ? deptLabels : ["No data"],
      colors: CHART_COLORS,
      legend: { position: "right", fontSize: "12px" },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: "65%",
            labels: {
              show: true,
              total: {
                show: true,
                label: "Total",
                formatter: () => `${deptTotal} Messages`,
              },
            },
          },
        },
      },
      noData: { text: "No department data" },
    },
  };

  const readCount = Number(readUnread.read ?? readUnread.Read ?? 0);
  const unreadCount = Number(readUnread.unread ?? readUnread.Unread ?? 0);
  const readTotal = readCount + unreadCount;
  const readPct = readTotal ? Math.round((readCount * 100) / readTotal) : 0;
  const unreadPct = readTotal ? 100 - readPct : 0;

  const readChart = {
    series: readTotal ? [readCount, unreadCount] : [0, 0],
    options: {
      chart: { type: "donut" },
      labels: ["Read", "Unread"],
      colors: ["#0ab39c", "#f06548"],
      legend: { show: false },
      dataLabels: { enabled: false },
      plotOptions: { pie: { donut: { size: "75%" } } },
    },
  };

  const analyticsBundle = useMemo(() => {
    if (analyticsPeriod === "month") {
      return {
        title: "This Month",
        points: monthly,
        totals: monthlyTotals,
        emptyLabels: Array.from({ length: 31 }, (_, i) => String(i + 1)),
      };
    }
    if (analyticsPeriod === "year") {
      return {
        title: "This Year",
        points: yearly,
        totals: yearlyTotals,
        emptyLabels: [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ],
      };
    }
    return {
      title: "This Week",
      points: weekly,
      totals: weeklyTotals,
      emptyLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    };
  }, [
    analyticsPeriod,
    weekly,
    weeklyTotals,
    monthly,
    monthlyTotals,
    yearly,
    yearlyTotals,
  ]);

  const periodLabels = analyticsBundle.points.map((p) => {
    const day = String(p.day || p.Day || "");
    if (analyticsPeriod === "week" && day.length > 3) return day.slice(0, 3);
    if (analyticsPeriod === "month") {
      const n = Number(day);
      return Number.isFinite(n) ? String(n) : day.replace(/^0/, "") || day;
    }
    return day;
  });
  const periodData = analyticsBundle.points.map((p) =>
    Number(p.count ?? p.Count ?? 0)
  );
  const periodTotals = analyticsBundle.totals || {};

  const activityChart = useMemo(() => {
    const categories = periodLabels.length
      ? periodLabels
      : analyticsBundle.emptyLabels;
    const dataPoints = periodData.length
      ? periodData
      : analyticsBundle.emptyLabels.map(() => 0);
    const isMonth = analyticsPeriod === "month";
    const isYear = analyticsPeriod === "year";

    return {
      series: [{ name: "Messages", data: dataPoints }],
      options: {
        chart: {
          type: "area",
          toolbar: { show: false },
          zoom: { enabled: false },
        },
        stroke: {
          curve: isYear ? "smooth" : isMonth ? "straight" : "smooth",
          width: isYear ? 3 : 2,
        },
        fill: {
          type: "gradient",
          gradient: {
            opacityFrom: isYear ? 0.45 : 0.4,
            opacityTo: 0.05,
          },
        },
        colors: ["#405189"],
        markers: isYear
          ? {
              size: 4,
              strokeWidth: 2,
              strokeColors: "#fff",
              hover: { size: 6 },
            }
          : { size: 0 },
        xaxis: {
          categories,
          tickAmount: isMonth ? 10 : undefined,
          labels: {
            style: { fontSize: isMonth ? "9px" : "11px", colors: "#878a99" },
            rotate: isMonth ? -45 : 0,
            rotateAlways: isMonth,
            hideOverlappingLabels: true,
          },
        },
        yaxis: {
          min: 0,
          forceNiceScale: true,
          labels: {
            style: { fontSize: "11px", colors: "#878a99" },
            formatter: (v) => Math.round(v),
          },
        },
        grid: {
          borderColor: "#f1f1f1",
          padding: { left: 4, right: 8 },
        },
        dataLabels: { enabled: false },
        tooltip: {
          y: { formatter: (v) => `${v} messages` },
        },
      },
    };
  }, [analyticsPeriod, analyticsBundle.emptyLabels, periodLabels, periodData]);

  const handleStatusChange = async (event) => {
    const next = event.target.value;
    setProfileStatus(next);
    setStatusSaving(true);
    try {
      await publishChatUserStatus(next, "");
      const me = String(sessionIdentity?.userId || "");
      if (me) {
        setPeerStatuses((prev) => ({
          ...prev,
          [me]: { status: next, statusMessage: "" },
        }));
      }
    } catch {
      // Presence publish is best-effort; keep UI selectable.
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Dashboard" pageTitle="Chat" />

        <Row className="mb-3 pb-1">
          <Col xs={12}>
            <div className="d-flex align-items-lg-center flex-lg-row flex-column">
              <div className="flex-grow-1">
                <h4 className="fs-16 mb-1">
                  Welcome back, {firstName(displayName)}!
                </h4>
                <p className="text-muted mb-0">
                  Here&apos;s your communication overview.
                </p>
              </div>
              <div className="mt-3 mt-lg-0 d-flex gap-2">
                <div className="input-group">
                  <Flatpickr
                    ref={datePickerRef}
                    className="form-control border-0 dash-filter-picker shadow"
                    value={dashboardDate}
                    options={{
                      dateFormat: "l, M j, Y",
                      allowInput: false,
                      disableMobile: true,
                      defaultDate: dashboardDate,
                    }}
                    onChange={(dates) => {
                      if (dates?.[0]) setDashboardDate(dates[0]);
                    }}
                  />
                  <button
                    type="button"
                    className="input-group-text bg-primary border-primary text-white"
                    title="Open calendar"
                    aria-label="Open calendar"
                    onClick={() => {
                      const fp =
                        datePickerRef.current?.flatpickr ||
                        datePickerRef.current;
                      fp?.open?.();
                    }}
                  >
                    <i className="ri-calendar-2-line"></i>
                  </button>
                </div>
                <Link to="/communication/messages" className="btn btn-primary">
                  <i className="ri-message-3-line align-middle me-1"></i> Open
                  Messages
                </Link>
              </div>
            </div>
          </Col>
        </Row>

        {error && (
          <Alert color="danger" className="d-flex align-items-center justify-content-between">
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-soft-danger" onClick={loadDashboard}>
              Retry
            </button>
          </Alert>
        )}

        {loading && (
          <div className="text-center text-muted py-5">
            <Spinner color="primary" className="mb-2" />
            <div className="fs-13">Loading dashboard...</div>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <Row>
              {stats.map((stat) => {
                const theme =
                  STAT_THEME[stat.label] || {
                    bgcolor: "primary",
                    icon: "ri-bar-chart-line",
                  };
                const numeric = typeof stat.value === "number";
                const cardInner = (
                  <Card className="card-animate mb-0 h-100" style={{ cursor: "pointer" }}>
                    <CardBody>
                      <div className="d-flex align-items-center">
                        <div className="flex-grow-1 overflow-hidden">
                          <p className="text-uppercase fw-medium text-muted text-truncate mb-0">
                            {stat.label}
                          </p>
                        </div>
                      </div>
                      <div className="d-flex align-items-end justify-content-between mt-4">
                        <div>
                          <h4 className="fs-22 fw-semibold ff-secondary mb-0">
                            {numeric ? (
                              <CountUp
                                key={`${stat.label}-${stat.value}`}
                                start={0}
                                end={stat.value}
                                duration={1.2}
                              />
                            ) : (
                              stat.value
                            )}
                          </h4>
                        </div>
                        <div className="avatar-sm flex-shrink-0">
                          <span
                            className={`avatar-title rounded fs-3 bg-${theme.bgcolor}-subtle`}
                          >
                            <i className={`text-${theme.bgcolor} ${theme.icon}`}></i>
                          </span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                );

                return (
                  <Col xl={2} md={4} sm={6} key={stat.label} className="mb-3">
                    {stat.action === "online-popup" ||
                    stat.action === "unread-popup" ||
                    stat.action === "sent-popup" ||
                    stat.action === "announcements-popup" ||
                    stat.action === "drafts-popup" ? (
                      <div
                        role="button"
                        tabIndex={0}
                        className="text-decoration-none text-body d-block h-100"
                        style={{ cursor: "pointer" }}
                        title={`Show ${stat.label}`}
                        onClick={() => {
                          if (stat.action === "online-popup")
                            setOnlineModalOpen(true);
                          else if (stat.action === "unread-popup")
                            setUnreadModalOpen(true);
                          else if (stat.action === "sent-popup")
                            setSentTodayModalOpen(true);
                          else if (stat.action === "announcements-popup")
                            setAnnouncementsModalOpen(true);
                          else setDraftsModalOpen(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (stat.action === "online-popup")
                              setOnlineModalOpen(true);
                            else if (stat.action === "unread-popup")
                              setUnreadModalOpen(true);
                            else if (stat.action === "sent-popup")
                              setSentTodayModalOpen(true);
                            else if (stat.action === "announcements-popup")
                              setAnnouncementsModalOpen(true);
                            else setDraftsModalOpen(true);
                          }
                        }}
                      >
                        {cardInner}
                      </div>
                    ) : (
                      <Link
                        to={stat.to}
                        className="text-decoration-none text-body d-block h-100"
                        title={`Open ${stat.label}`}
                      >
                        {cardInner}
                      </Link>
                    )}
                  </Col>
                );
              })}
            </Row>

            <Modal
              isOpen={onlineModalOpen}
              toggle={() => setOnlineModalOpen(false)}
              centered
              size="md"
            >
              <ModalHeader toggle={() => setOnlineModalOpen(false)}>
                Online Employees{" "}
                <span className="text-muted fs-13 fw-normal">
                  ({liveOnlineCount} / {totalEmployees})
                </span>
              </ModalHeader>
              <ModalBody style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {orgUsers.length === 0 ? (
                  <EmptyBlock message="No organisation users found." />
                ) : (
                  <>
                    <h6 className="text-success mb-2">
                      <i className="ri-checkbox-blank-circle-fill me-1 fs-10"></i>
                      Online ({onlineUsersList.length})
                    </h6>
                    {!onlineUsersList.length ? (
                      <p className="text-muted fs-13 mb-3">No one is online right now.</p>
                    ) : (
                      <div className="vstack gap-2 mb-3">
                        {onlineUsersList.map((user) => (
                          <Link
                            key={user.id}
                            to="/communication/messages"
                            state={{ openPeerUserId: user.id }}
                            className="d-flex align-items-center text-decoration-none text-body p-2 rounded border"
                            onClick={() => setOnlineModalOpen(false)}
                          >
                            <div className="avatar-xs flex-shrink-0">
                              <img
                                src={getCommAvatarSrc(user.id, user.photo)}
                                alt=""
                                className="rounded-circle img-fluid userprofile"
                              />
                            </div>
                            <div className="flex-grow-1 ms-3 overflow-hidden">
                              <p className="mb-0 fw-medium fs-13 text-truncate">
                                {user.name}
                              </p>
                              <small className="text-muted text-truncate d-block">
                                {user.jobTitle || user.department || user.email || ""}
                              </small>
                            </div>
                            <span className="badge bg-success-subtle text-success">
                              Online
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}

                    <h6 className="text-muted mb-2">
                      Offline ({offlineUsersList.length})
                    </h6>
                    {!offlineUsersList.length ? (
                      <p className="text-muted fs-13 mb-0">Everyone is online.</p>
                    ) : (
                      <div className="vstack gap-2">
                        {offlineUsersList.map((user) => (
                          <Link
                            key={user.id}
                            to="/communication/messages"
                            state={{ openPeerUserId: user.id }}
                            className="d-flex align-items-center text-decoration-none text-body p-2 rounded border"
                            onClick={() => setOnlineModalOpen(false)}
                          >
                            <div className="avatar-xs flex-shrink-0">
                              <img
                                src={getCommAvatarSrc(user.id, user.photo)}
                                alt=""
                                className="rounded-circle img-fluid userprofile"
                              />
                            </div>
                            <div className="flex-grow-1 ms-3 overflow-hidden">
                              <p className="mb-0 fw-medium fs-13 text-truncate">
                                {user.name}
                              </p>
                              <small className="text-muted text-truncate d-block">
                                {user.jobTitle || user.department || user.email || ""}
                              </small>
                            </div>
                            <span className="badge bg-secondary-subtle text-secondary">
                              Offline
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </ModalBody>
            </Modal>

            <Modal
              isOpen={unreadModalOpen}
              toggle={() => setUnreadModalOpen(false)}
              centered
              size="md"
            >
              <ModalHeader toggle={() => setUnreadModalOpen(false)}>
                Unread Messages{" "}
                <span className="text-muted fs-13 fw-normal">
                  ({Number(summary.unreadMessages ?? summary.UnreadMessages ?? 0)})
                </span>
              </ModalHeader>
              <ModalBody style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {!unreadMessageList.length ? (
                  <EmptyBlock message="No unread messages." />
                ) : (
                  <div className="vstack gap-2">
                    {unreadMessageList.map((msg, index) => {
                      const id = msg.messageId ?? msg.MessageId;
                      const peerId = msg.senderUserId ?? msg.SenderUserId;
                      const groupId = msg.groupId ?? msg.GroupId;
                      const isGroup = Boolean(msg.isGroup || msg.IsGroup);
                      const isOutgoing = Boolean(msg.isOutgoing || msg.IsOutgoing);
                      const groupName = msg.groupName || msg.GroupName || "Group";
                      const peerName = resolveChatUserName(
                        peerId,
                        msg.senderName || msg.SenderName
                      );
                      const title = isGroup
                        ? isOutgoing
                          ? `${groupName} · ${peerName}`
                          : groupName
                        : peerName;
                      const photo = resolveChatUserDp(
                        peerId,
                        msg.senderPhotoUrl || msg.SenderPhotoUrl
                      );
                      const to = isGroup
                        ? "/communication/groups"
                        : "/communication/messages";
                      const linkState = isGroup
                        ? groupId
                          ? { openGroupId: groupId }
                          : undefined
                        : peerId
                          ? { openPeerUserId: peerId }
                          : undefined;
                      return (
                        <Link
                          key={`${id}-${peerId}-${index}`}
                          to={to}
                          state={linkState}
                          className="d-flex align-items-center text-decoration-none text-body p-2 rounded border"
                          onClick={() => setUnreadModalOpen(false)}
                        >
                          <div className="avatar-xs flex-shrink-0">
                            <img
                              src={photo}
                              alt=""
                              className="rounded-circle img-fluid userprofile"
                            />
                          </div>
                          <div className="flex-grow-1 ms-3 overflow-hidden">
                            <div className="d-flex justify-content-between gap-2">
                              <p className="text-truncate fs-13 mb-0 fw-medium">
                                {title}
                              </p>
                              <small className="text-muted flex-shrink-0">
                                {formatDashboardTime(msg.sentAt || msg.SentAt)}
                              </small>
                            </div>
                            <p className="text-muted text-truncate fs-12 mb-0">
                              {msg.preview || msg.Preview || ""}
                            </p>
                          </div>
                          <span
                            className={`badge ms-2 ${
                              isOutgoing
                                ? "bg-warning-subtle text-warning"
                                : "bg-danger-subtle text-danger"
                            }`}
                          >
                            {isOutgoing ? "Pending" : "New"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </ModalBody>
            </Modal>

            <Modal
              isOpen={sentTodayModalOpen}
              toggle={() => setSentTodayModalOpen(false)}
              centered
              size="md"
            >
              <ModalHeader toggle={() => setSentTodayModalOpen(false)}>
                Sent Today{" "}
                <span className="text-muted fs-13 fw-normal">
                  ({Number(summary.sentToday ?? summary.SentToday ?? 0)})
                </span>
              </ModalHeader>
              <ModalBody style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {!sentTodayList.length ? (
                  <EmptyBlock message="No messages sent today." />
                ) : (
                  <div className="vstack gap-2">
                    {sentTodayList.map((msg) => {
                      const id = msg.messageId ?? msg.MessageId;
                      const isGroup = Boolean(msg.isGroup || msg.IsGroup);
                      const groupId = msg.groupId ?? msg.GroupId;
                      const peerId =
                        msg.recipientUserId ?? msg.RecipientUserId;
                      const title = isGroup
                        ? msg.recipientName ||
                          msg.RecipientName ||
                          "Group"
                        : resolveChatUserName(
                            peerId,
                            msg.recipientName || msg.RecipientName
                          );
                      const photo = isGroup
                        ? resolvePhoto(
                            msg.recipientPhotoUrl || msg.RecipientPhotoUrl
                          )
                        : resolveChatUserDp(
                            peerId,
                            msg.recipientPhotoUrl || msg.RecipientPhotoUrl
                          );
                      const to = isGroup
                        ? "/communication/groups"
                        : "/communication/messages";
                      const linkState = isGroup
                        ? groupId
                          ? { openGroupId: groupId }
                          : undefined
                        : peerId
                          ? { openPeerUserId: peerId }
                          : undefined;
                      return (
                        <Link
                          key={id}
                          to={to}
                          state={linkState}
                          className="d-flex align-items-center text-decoration-none text-body p-2 rounded border"
                          onClick={() => setSentTodayModalOpen(false)}
                        >
                          <div className="avatar-xs flex-shrink-0">
                            <img
                              src={
                                isGroup
                                  ? getCommAvatarSrc(id, photo)
                                  : photo
                              }
                              alt=""
                              className="rounded-circle img-fluid userprofile"
                            />
                          </div>
                          <div className="flex-grow-1 ms-3 overflow-hidden">
                            <div className="d-flex justify-content-between gap-2">
                              <p className="text-truncate fs-13 mb-0 fw-medium">
                                {title}
                              </p>
                              <small className="text-muted flex-shrink-0">
                                {formatDashboardTime(msg.sentAt || msg.SentAt)}
                              </small>
                            </div>
                            <p className="text-muted text-truncate fs-12 mb-0">
                              {msg.preview || msg.Preview || ""}
                            </p>
                          </div>
                          <span className="badge bg-success-subtle text-success ms-2">
                            {isGroup ? "Group" : "Chat"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </ModalBody>
            </Modal>

            <Modal
              isOpen={announcementsModalOpen}
              toggle={() => setAnnouncementsModalOpen(false)}
              centered
              size="md"
            >
              <ModalHeader toggle={() => setAnnouncementsModalOpen(false)}>
                Announcements{" "}
                <span className="text-muted fs-13 fw-normal">
                  ({unreadAnnouncementCount})
                </span>
              </ModalHeader>
              <ModalBody style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {!unreadAnnouncementList.length ? (
                  <EmptyBlock message="No unread announcements." />
                ) : (
                  <div className="vstack gap-2">
                    {unreadAnnouncementList.map((a) => {
                      const announcementId =
                        a.announcementId ?? a.AnnouncementId;
                      const postedBy = a.postedBy ?? a.PostedBy;
                      const title = a.title || a.Title || "Announcement";
                      const preview =
                        a.description || a.Description || "";
                      const photo = resolveChatUserDp(
                        postedBy,
                        a.postedByAvatar || a.PostedByAvatar
                      );
                      return (
                        <button
                          type="button"
                          key={announcementId}
                          className="d-flex align-items-center text-start text-decoration-none text-body p-2 rounded border w-100 bg-transparent"
                          onClick={() => {
                            setAnnouncementsModalOpen(false);
                            markAnnouncementSeen(announcementId, {
                              navigateAfter: true,
                            });
                          }}
                        >
                          <div className="avatar-xs flex-shrink-0">
                            <img
                              src={photo}
                              alt=""
                              className="rounded-circle img-fluid userprofile"
                            />
                          </div>
                          <div className="flex-grow-1 ms-3 overflow-hidden">
                            <div className="d-flex justify-content-between gap-2">
                              <p className="text-truncate fs-13 mb-0 fw-medium">
                                {title}
                              </p>
                              <small className="text-muted flex-shrink-0">
                                {formatDashboardTime(
                                  a.postedDate || a.PostedDate
                                )}
                              </small>
                            </div>
                            <p className="text-muted text-truncate fs-12 mb-0">
                              {previewText(preview, 80)}
                            </p>
                          </div>
                          <span className="badge bg-danger-subtle text-danger ms-2">
                            Open
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ModalBody>
            </Modal>

            <Modal
              isOpen={draftsModalOpen}
              toggle={() => setDraftsModalOpen(false)}
              centered
              size="md"
            >
              <ModalHeader toggle={() => setDraftsModalOpen(false)}>
                Drafts{" "}
                <span className="text-muted fs-13 fw-normal">
                  ({composerDraftCount})
                </span>
              </ModalHeader>
              <ModalBody style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {!composerDraftRows.length ? (
                  <EmptyBlock message="No draft messages. Type in Messages/Groups and leave without sending — it will appear here." />
                ) : (
                  <div className="vstack gap-2">
                    {composerDraftRows.map((d) => {
                      const isGroup = d.type === "group" || String(d.key || "").startsWith("group:");
                      const peerId = String(d.key || "").startsWith("dm:")
                        ? String(d.key).slice(3)
                        : null;
                      const groupId = String(d.key || "").startsWith("group:")
                        ? String(d.key).slice(6)
                        : null;
                      const to = isGroup
                        ? "/communication/groups"
                        : "/communication/messages";
                      const linkState = isGroup
                        ? groupId
                          ? { openGroupId: groupId }
                          : undefined
                        : peerId
                          ? { openPeerUserId: peerId }
                          : undefined;
                      const photo = d.photo
                        ? getCommAvatarSrc(d.key, d.photo)
                        : getCommAvatarSrc(d.key, null);
                      return (
                        <Link
                          key={d.key}
                          to={to}
                          state={linkState}
                          className="d-flex align-items-center text-decoration-none text-body p-2 rounded border"
                          onClick={() => setDraftsModalOpen(false)}
                        >
                          <div className="avatar-xs flex-shrink-0">
                            <img
                              src={photo}
                              alt=""
                              className="rounded-circle img-fluid userprofile"
                            />
                          </div>
                          <div className="flex-grow-1 ms-3 overflow-hidden">
                            <div className="d-flex justify-content-between gap-2">
                              <p className="text-truncate fs-13 mb-0 fw-medium">
                                {d.name || (isGroup ? "Group draft" : "Chat draft")}
                              </p>
                              <span className="badge bg-secondary-subtle text-secondary flex-shrink-0">
                                Draft
                              </span>
                            </div>
                            <p className="text-muted text-truncate fs-12 mb-0">
                              {d.preview || d.text || ""}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </ModalBody>
            </Modal>

            <Row className="mt-3">
              <Col xl={4} md={6}>
                <Card className="h-100" style={{ cursor: "pointer" }}>
                  <CardHeader className="align-items-center d-flex">
                    <h4 className="card-title mb-0 flex-grow-1">
                      <Link
                        to="/communication/messages"
                        className="text-decoration-none text-body"
                      >
                        Recent Messages
                      </Link>
                    </h4>
                    <Link
                      to="/communication/messages"
                      className="btn btn-soft-primary btn-sm"
                    >
                      View All
                    </Link>
                  </CardHeader>
                  <CardBody>
                    {!recentMessages.length ? (
                      <EmptyBlock message="No recent messages." />
                    ) : (
                      <div className="vstack gap-3">
                        {recentMessages.map((msg) => {
                          const id = msg.messageId ?? msg.MessageId;
                          const peerId = msg.senderUserId || msg.SenderUserId;
                          const groupId = msg.groupId ?? msg.GroupId;
                          const isGroup = Boolean(msg.isGroup || msg.IsGroup);
                          const sender = isGroup
                            ? msg.groupName ||
                              msg.GroupName ||
                              msg.senderName ||
                              msg.SenderName
                            : resolveChatUserName(
                                peerId,
                                msg.senderName || msg.SenderName
                              );
                          const photo = resolveChatUserDp(
                            peerId,
                            msg.senderPhotoUrl || msg.SenderPhotoUrl
                          );
                          const unread = Boolean(msg.isUnread ?? msg.IsUnread);
                          const to = isGroup
                            ? "/communication/groups"
                            : "/communication/messages";
                          const linkState = isGroup
                            ? groupId
                              ? { openGroupId: groupId }
                              : undefined
                            : peerId
                              ? { openPeerUserId: peerId }
                              : undefined;
                          return (
                            <Link
                              key={id}
                              to={to}
                              state={linkState}
                              className="d-flex align-items-center text-decoration-none text-body"
                            >
                              <div className="avatar-xs flex-shrink-0">
                                <img
                                  src={photo}
                                  alt=""
                                  className="rounded-circle img-fluid userprofile"
                                />
                              </div>
                              <div className="flex-grow-1 ms-3 overflow-hidden">
                                <div className="d-flex justify-content-between">
                                  <p className="text-truncate fs-13 mb-0 fw-medium">
                                    {sender}
                                  </p>
                                  <small className="text-muted">
                                    {formatDashboardTime(msg.sentAt || msg.SentAt)}
                                  </small>
                                </div>
                                <p className="text-muted text-truncate fs-12 mb-0">
                                  {msg.preview || msg.Preview || ""}
                                </p>
                              </div>
                              {unread && (
                                <span className="badge bg-danger-subtle text-danger ms-2">
                                  New
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </Col>

              <Col xl={4} md={6}>
                <Card className="h-100" style={{ cursor: "pointer" }}>
                  <CardHeader className="align-items-center d-flex">
                    <h4 className="card-title mb-0 flex-grow-1">
                      <Link
                        to="/communication/messages?view=sent"
                        className="text-decoration-none text-body"
                      >
                        Recent Sent Messages
                      </Link>
                    </h4>
                    <Link
                      to="/communication/messages?view=sent"
                      className="btn btn-soft-primary btn-sm"
                    >
                      View All
                    </Link>
                  </CardHeader>
                  <CardBody>
                    {!recentSent.length ? (
                      <EmptyBlock message="No sent messages yet." />
                    ) : (
                      <div className="vstack gap-3">
                        {recentSent.map((msg) => {
                          const id = msg.messageId ?? msg.MessageId;
                          const isGroup = Boolean(msg.isGroup || msg.IsGroup);
                          const groupId = msg.groupId ?? msg.GroupId;
                          const recipientId =
                            msg.recipientUserId ?? msg.RecipientUserId;
                          const recipientName = isGroup
                            ? msg.recipientName || msg.RecipientName || "Group"
                            : resolveChatUserName(
                                recipientId,
                                msg.recipientName || msg.RecipientName
                              );
                          const photo = isGroup
                            ? getCommAvatarSrc(
                                id,
                                resolvePhoto(
                                  msg.recipientPhotoUrl || msg.RecipientPhotoUrl
                                )
                              )
                            : resolveChatUserDp(
                                recipientId,
                                msg.recipientPhotoUrl || msg.RecipientPhotoUrl
                              );
                          const isRead = Boolean(msg.isRead ?? msg.IsRead);
                          const to = isGroup
                            ? "/communication/groups"
                            : "/communication/messages";
                          const linkState = isGroup
                            ? groupId
                              ? { openGroupId: groupId }
                              : undefined
                            : recipientId
                              ? { openPeerUserId: recipientId }
                              : undefined;
                          return (
                            <Link
                              key={id}
                              to={to}
                              state={linkState}
                              className="d-flex align-items-center text-decoration-none text-body"
                            >
                              <div className="avatar-xs flex-shrink-0">
                                <img
                                  src={photo}
                                  alt=""
                                  className="rounded-circle img-fluid userprofile"
                                />
                              </div>
                              <div className="flex-grow-1 ms-3 overflow-hidden">
                                <div className="d-flex justify-content-between">
                                  <p className="text-truncate fs-13 mb-0 fw-medium">
                                    {recipientName}
                                  </p>
                                  <small className="text-muted">
                                    {formatDashboardTime(msg.sentAt || msg.SentAt)}
                                  </small>
                                </div>
                                <p className="text-muted text-truncate fs-12 mb-0">
                                  {msg.preview || msg.Preview || ""}
                                </p>
                              </div>
                              <i
                                className={`ri-check-double-line ms-2 ${
                                  isRead ? "text-success" : "text-muted"
                                }`}
                                title={msg.readStatus || msg.ReadStatus || ""}
                              ></i>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </Col>

              <Col xl={4}>
                <Link
                  to="/communication/management"
                  className="text-decoration-none text-body"
                  title="Open Analytics"
                >
                  <Card className="h-100" style={{ cursor: "pointer" }}>
                    <CardHeader>
                      <h4 className="card-title mb-0">
                        Department-wise Message Summary
                      </h4>
                    </CardHeader>
                    <CardBody>
                      {!departments.length ? (
                        <EmptyBlock message="No department message data." />
                      ) : (
                        <ReactApexChart
                          options={deptChart.options}
                          series={deptChart.series}
                          type="donut"
                          height={280}
                        />
                      )}
                    </CardBody>
                  </Card>
                </Link>
              </Col>
            </Row>

            <Row className="mt-3 align-items-stretch">
              <Col xl={4} md={6} className="mb-3 d-flex">
                <Card className="w-100 overflow-hidden">
                  <CardHeader className="align-items-center d-flex">
                    <h4 className="card-title mb-0 flex-grow-1">
                      Recent Announcements
                    </h4>
                    <Link
                      to="/communication/announcements"
                      className="btn btn-soft-primary btn-sm"
                    >
                      View All
                    </Link>
                  </CardHeader>
                  <CardBody className="p-0">
                    {!announcements.length ? (
                      <div className="p-3" style={{ height: 230 }}>
                        <EmptyBlock message="No announcements." />
                      </div>
                    ) : (
                      <div
                        className="recent-announcements-scroll px-3 py-2"
                        style={{
                          height: 230,
                          maxHeight: 230,
                          overflowY: "auto",
                          overflowX: "hidden",
                          scrollbarGutter: "stable",
                        }}
                      >
                        <div className="vstack gap-0">
                        {announcements.map((a, index, list) => {
                          const status = resolveAnnouncementStatus(a);
                          const badge = statusBadgeClass(status);
                          const announcementId =
                            a.announcementId ?? a.AnnouncementId;
                          const category =
                            a.categoryName || a.CategoryName || "";
                          const department =
                            a.departmentName || a.DepartmentName || "";
                          const scopeLabel =
                            department || category || "Organization Wide";
                          const { icon, color } = announcementCategoryIcon(
                            category || department
                          );
                          const pinned = Boolean(a.isPinned ?? a.IsPinned);
                          const important = Boolean(
                            a.isImportant ?? a.IsImportant
                          );
                          const description =
                            a.description || a.Description || "";
                          const postedBy = a.postedBy ?? a.PostedBy ?? null;
                          const isPosterMe =
                            sessionIdentity?.userId != null &&
                            String(postedBy) === String(sessionIdentity.userId);
                          const author = isPosterMe
                            ? sessionIdentity.displayName ||
                              resolveChatUserName(
                                postedBy,
                                a.postedByName || a.PostedByName
                              )
                            : resolveChatUserName(
                                postedBy,
                                a.postedByName || a.PostedByName
                              );
                          const authorRole = isPosterMe
                            ? sessionIdentity.jobTitle ||
                              sessionIdentity.role ||
                              orgUserById.get(String(postedBy))?.jobTitle ||
                              ""
                            : orgUserById.get(String(postedBy))?.jobTitle || "";
                          const avatarSrc = resolveChatUserDp(
                            postedBy,
                            isPosterMe ? sessionIdentity.profileImage : null
                          );
                          return (
                            <button
                              type="button"
                              key={announcementId}
                              onClick={() =>
                                markAnnouncementSeen(announcementId, {
                                  navigateAfter: true,
                                })
                              }
                              className={`d-flex align-items-start gap-2 text-start text-decoration-none text-body py-2 w-100 bg-transparent border-0${
                                index < list.length - 1 ? " border-bottom" : ""
                              }`}
                            >
                              <span className="avatar-xs flex-shrink-0">
                                <span
                                  className="avatar-title rounded fs-5"
                                  style={{
                                    background: `${color}22`,
                                    color,
                                  }}
                                >
                                  <i className={icon}></i>
                                </span>
                              </span>
                              <div className="flex-grow-1 min-w-0">
                                <div className="d-flex flex-wrap align-items-center gap-1 mb-1">
                                  {pinned ? (
                                    <span className="badge bg-primary-subtle text-primary">
                                      Pinned
                                    </span>
                                  ) : null}
                                  <span className="badge bg-primary-subtle text-primary">
                                    {scopeLabel}
                                  </span>
                                  {important ? (
                                    <span className="badge bg-danger-subtle text-danger">
                                      Important
                                    </span>
                                  ) : null}
                                </div>
                                <h6 className="mb-0 fs-13 text-truncate">
                                  {a.title || a.Title}
                                </h6>
                                {description ? (
                                  <p className="text-muted fs-12 mb-1 text-truncate">
                                    {previewText(description, 60)}
                                  </p>
                                ) : null}
                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-1">
                                  <div className="d-flex align-items-center gap-2 min-w-0">
                                    <div className="avatar-xs flex-shrink-0">
                                      <img
                                        src={avatarSrc}
                                        alt=""
                                        className="rounded-circle img-fluid userprofile"
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="fs-12 text-truncate">
                                        <span className="fw-medium">{author}</span>
                                        {authorRole ? (
                                          <span className="text-muted">
                                            {" "}
                                            · {authorRole}
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="text-muted fs-11">
                                        {formatDashboardTime(
                                          a.postedDate || a.PostedDate
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {status ? (
                                    <span
                                      className={`badge bg-${badge.bg}-subtle text-${badge.text}`}
                                    >
                                      {status}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </Col>

              <Col xl={4} md={6} className="mb-3 d-flex">
                <Card className="w-100 overflow-hidden">
                  <CardHeader>
                    <h4 className="card-title mb-0">Read vs Unread</h4>
                  </CardHeader>
                  <CardBody className="py-2" style={{ height: 230 }}>
                    {!readTotal ? (
                      <EmptyBlock message="No message read data yet." />
                    ) : (
                      <>
                        <ReactApexChart
                          options={readChart.options}
                          series={readChart.series}
                          type="donut"
                          height={160}
                        />
                        <Row className="text-center mt-1">
                          <Col>
                            <h5 className="mb-0 text-success fs-16">{readCount}</h5>
                            <p className="text-muted fs-12 mb-0">
                              Read ({readPct}%)
                            </p>
                          </Col>
                          <Col>
                            <h5 className="mb-0 text-danger fs-16">{unreadCount}</h5>
                            <p className="text-muted fs-12 mb-0">
                              Unread ({unreadPct}%)
                            </p>
                          </Col>
                        </Row>
                      </>
                    )}
                  </CardBody>
                </Card>
              </Col>

              <Col xl={4} className="mb-3 d-flex">
                <Card className="w-100 overflow-hidden">
                  <CardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <h4 className="card-title mb-0">
                      Communication Analytics ({analyticsBundle.title})
                    </h4>
                    <div className="btn-group btn-group-sm" role="group">
                      {[
                        { id: "week", label: "Week" },
                        { id: "month", label: "Month" },
                        { id: "year", label: "Year" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={`btn ${
                            analyticsPeriod === opt.id
                              ? "btn-primary"
                              : "btn-soft-primary"
                          }`}
                          onClick={() => setAnalyticsPeriod(opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardBody
                    className="py-2"
                    style={{ height: analyticsPeriod === "month" ? 260 : 230 }}
                  >
                    <ReactApexChart
                      key={`analytics-${analyticsPeriod}-${periodData.join("-")}`}
                      options={activityChart.options}
                      series={activityChart.series}
                      type="area"
                      height={analyticsPeriod === "month" ? 175 : 150}
                    />
                    <Row className="text-center mt-2 g-2">
                      <Col xs={4}>
                        <h6 className="mb-0">
                          {Number(periodTotals.sent ?? periodTotals.Sent ?? 0)}
                        </h6>
                        <small className="text-muted">Sent</small>
                      </Col>
                      <Col xs={4}>
                        <h6 className="mb-0">
                          {Number(
                            periodTotals.received ?? periodTotals.Received ?? 0
                          )}
                        </h6>
                        <small className="text-muted">Received</small>
                      </Col>
                      <Col xs={4}>
                        <h6 className="mb-0">
                          {Number(
                            periodTotals.replies ?? periodTotals.Replies ?? 0
                          )}
                        </h6>
                        <small className="text-muted">Replies</small>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>
              </Col>
            </Row>

            <Row className="mt-3">
              <Col xl={4}>
                <Card className="card-height-100">
                  <CardHeader>
                    <h4 className="card-title mb-0">My Profile</h4>
                  </CardHeader>
                  <CardBody className="text-center">
                    <CommAvatar
                      id={sessionIdentity?.userId || 1}
                      src={profilePhoto}
                      size="lg"
                      className="mx-auto mb-3"
                    />
                    <h5 className="mb-1">{displayName}</h5>
                    {displayRole ? (
                      <p className="text-muted mb-1">{displayRole}</p>
                    ) : null}
                    {displayEmail ? (
                      <p className="text-muted fs-12">{displayEmail}</p>
                    ) : null}
                    <select
                      className="form-select form-select-sm mt-3"
                      value={profileStatus}
                      disabled={statusSaving}
                      onChange={handleStatusChange}
                    >
                      <option value="Online">Online</option>
                      <option value="Away">Away</option>
                      <option value="Busy">Busy</option>
                      <option value="Offline">Offline</option>
                    </select>
                    <p className="text-muted fs-12 mt-2 mb-0">
                      Showing profiles with status{" "}
                      <strong>{profileStatus}</strong>
                    </p>
                  </CardBody>
                </Card>
              </Col>

              <Col xl={8}>
                <Card className="card-height-100">
                  <CardHeader className="align-items-center d-flex">
                    <h4 className="card-title mb-0 flex-grow-1">
                      {profileStatus} Profiles ({statusFilteredProfiles.length})
                    </h4>
                  </CardHeader>
                  <CardBody style={{ maxHeight: 280, overflowY: "auto" }}>
                    {!statusFilteredProfiles.length ? (
                      <EmptyBlock
                        message={`No ${profileStatus.toLowerCase()} profiles right now.`}
                      />
                    ) : (
                      <Row>
                        {statusFilteredProfiles.map((u) => (
                          <Col md={6} key={u.id}>
                            <Link
                              to="/communication/messages"
                              state={{ openPeerUserId: u.id }}
                              className="d-flex align-items-center mb-3 text-decoration-none text-body"
                            >
                              <CommAvatar
                                id={u.id}
                                src={getCommAvatarSrc(u.id, u.photo)}
                              />
                              <div className="flex-grow-1 ms-3 overflow-hidden">
                                <h6 className="fs-14 mb-0 text-truncate">
                                  {u.name}
                                </h6>
                                <span
                                  className={`badge fs-10 bg-${
                                    profileStatus === "Online"
                                      ? "success"
                                      : profileStatus === "Away"
                                        ? "warning"
                                        : profileStatus === "Busy"
                                          ? "danger"
                                          : "secondary"
                                  }-subtle text-${
                                    profileStatus === "Online"
                                      ? "success"
                                      : profileStatus === "Away"
                                        ? "warning"
                                        : profileStatus === "Busy"
                                          ? "danger"
                                          : "secondary"
                                  }`}
                                >
                                  {resolvePeerPresence(u.id)}
                                </span>
                                {u.department || u.jobTitle ? (
                                  <div className="text-muted fs-11 text-truncate">
                                    {u.jobTitle || u.department}
                                  </div>
                                ) : null}
                              </div>
                            </Link>
                          </Col>
                        ))}
                      </Row>
                    )}
                  </CardBody>
                </Card>
              </Col>
            </Row>
          </>
        )}

        {!loading && !error && !data && (
          <EmptyBlock message="Dashboard data is unavailable." />
        )}
      </Container>
    </div>
  );
};

export default Dashboard;
