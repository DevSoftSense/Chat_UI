export const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "organization", label: "Organization" },
  { id: "department", label: "Department" },
  { id: "location", label: "Location" },
  { id: "important", label: "Important" },
];

export const SORT_OPTIONS = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "important", label: "Important" },
  { id: "most_read", label: "Most Read" },
];

export const DEFAULT_PAGE_SIZE = 4;

/** New announcements default to expire after this many hours. */
export const DEFAULT_EXPIRY_HOURS = 1;

/** Re-check Active → Expired on the list without a full page reload. */
export const STATUS_TICK_MS = 30_000;
