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
