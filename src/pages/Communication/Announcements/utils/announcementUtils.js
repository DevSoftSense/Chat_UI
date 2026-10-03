import { DEFAULT_EXPIRY_HOURS } from "../constants/announcementConstants";

/** Convert ISO/UTC expiry to datetime-local value (local wall clock). */
export const toDatetimeLocalValue = (value) => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** datetime-local value for "now + N hours" (default 1 hour). */
export const defaultExpiryDatetimeLocal = (hours = DEFAULT_EXPIRY_HOURS) => {
  const d = new Date(Date.now() + Number(hours) * 60 * 60 * 1000);
  return toDatetimeLocalValue(d);
};

/**
 * Display status from expiry time:
 * - Expired when expiryDate is in the past
 * - Active until then (ignores API "Expiring Soon" for short windows)
 * Recipients do not affect status.
 */
export const resolveAnnouncementStatus = (item, now = Date.now()) => {
  if (!item) return "";
  const stored = String(item.statusName ?? item.StatusName ?? "").trim();
  if (stored.toLowerCase() === "deleted") return stored || "Deleted";

  const expiryRaw = item.expiryDate ?? item.ExpiryDate ?? null;
  if (expiryRaw) {
    const expiryMs = new Date(expiryRaw).getTime();
    if (!Number.isNaN(expiryMs)) {
      return expiryMs < now ? "Expired" : "Active";
    }
  }

  const lower = stored.toLowerCase();
  if (lower === "expired") return "Expired";
  // API "Expiring Soon" (within 7 days) → still Active until expiry passes
  if (lower.includes("expir")) return "Active";
  return stored || "Active";
};

export const formatAnnouncementDate = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return value;
    const d = new Date(parsed);
    try {
      return d.toLocaleString([], {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return d.toLocaleString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
};

export const previewText = (text, max = 160) => {
  const raw = String(text || "").trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max).trim()}…`;
};

export const statusBadgeClass = (statusName) => {
  const s = String(statusName || "").toLowerCase();
  if (s === "active") return { bg: "success", text: "success" };
  if (s === "expired") return { bg: "danger", text: "danger" };
  if (s.includes("expir")) return { bg: "warning", text: "warning" };
  if (s === "draft") return { bg: "warning", text: "warning" };
  return { bg: "primary", text: "primary" };
};

export const apiErrorMessage = (error, fallback = "Something went wrong.") =>
  error?.message ||
  error?.data?.message ||
  error?.response?.data?.message ||
  fallback;

/** Match Department filter tab: department_id set OR category named like *Department* */
export const isDepartmentAnnouncement = (item) => {
  if (!item) return false;
  const deptId = item.departmentId ?? item.DepartmentId;
  if (deptId != null && Number(deptId) > 0) return true;
  const deptName = String(
    item.departmentName ?? item.DepartmentName ?? ""
  ).trim();
  if (deptName) return true;
  const cat = String(item.categoryName ?? item.CategoryName ?? "").toLowerCase();
  return cat.includes("department");
};

export const matchesAnnouncementFilter = (item, filter) => {
  const f = String(filter || "all").toLowerCase();
  if (!f || f === "all") return true;
  if (f === "important") {
    return Boolean(item?.isImportant ?? item?.IsImportant);
  }
  if (f === "department") return isDepartmentAnnouncement(item);
  if (f === "location") {
    return Boolean(String(item?.location ?? item?.Location ?? "").trim());
  }
  if (f === "organization") {
    return (
      !isDepartmentAnnouncement(item) &&
      !String(item?.location ?? item?.Location ?? "").trim()
    );
  }
  return true;
};

/** Department dropdown options from category master (*Department* names). */
export const departmentOptionsFromCategories = (categories = []) => {
  const seen = new Set();
  const options = [];
  (categories || []).forEach((c) => {
    const name = String(c.categoryName ?? c.CategoryName ?? "").trim();
    if (!name || !name.toLowerCase().includes("department")) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push(name);
  });
  return options;
};
