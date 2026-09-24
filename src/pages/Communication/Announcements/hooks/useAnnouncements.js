import { useCallback, useEffect, useState } from "react";
import {
  getAnnouncements,
  getAnnouncementCategories,
  getAnnouncementStats,
} from "../services/announcementService";
import { DEFAULT_PAGE_SIZE } from "../constants/announcementConstants";
import {
  apiErrorMessage,
  matchesAnnouncementFilter,
} from "../utils/announcementUtils";

const TAB_FILTERS = new Set([
  "department",
  "organization",
  "location",
  "important",
]);

const useAnnouncements = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({
    totalAnnouncements: 0,
    totalReads: 0,
    unreadByMe: 0,
  });
  const [filter, setFilter] = useState("all");
  const [categoryId, setCategoryId] = useState(null);
  const [sortBy, setSortBy] = useState("newest");
  const [search, setSearch] = useState("");

  const loadMeta = useCallback(async () => {
    const [cats, st] = await Promise.all([
      getAnnouncementCategories(),
      getAnnouncementStats(),
    ]);
    setCategories(Array.isArray(cats) ? cats : []);
    setStats({
      totalAnnouncements: Number(
        st?.totalAnnouncements ?? st?.TotalAnnouncements ?? 0
      ),
      totalReads: Number(st?.totalReads ?? st?.TotalReads ?? 0),
      unreadByMe: Number(st?.unreadByMe ?? st?.UnreadByMe ?? 0),
    });
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Tab filters: fetch without server filter then filter client-side so
      // IT/HR category announcements still show when DB SQL is outdated.
      const useClientFilter = TAB_FILTERS.has(filter);
      const q = search.trim().toLowerCase();
      const result = await getAnnouncements({
        page: useClientFilter || q ? 1 : page,
        pageSize: useClientFilter || q ? 100 : pageSize,
        filter: useClientFilter || filter === "all" ? undefined : filter,
        categoryId: categoryId || undefined,
        sortBy,
        search: q || undefined,
      });
      let list = result.items || [];

      // Always apply search client-side too (title / description / category / dept)
      if (q) {
        list = list.filter((item) => {
          const hay = [
            item.title ?? item.Title,
            item.description ?? item.Description,
            item.categoryName ?? item.CategoryName,
            item.departmentName ?? item.DepartmentName,
            item.location ?? item.Location,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
      }

      if (useClientFilter) {
        list = list.filter((item) => matchesAnnouncementFilter(item, filter));
      }

      if (useClientFilter || q) {
        const start = (page - 1) * pageSize;
        setTotalCount(list.length);
        setItems(list.slice(start, start + pageSize));
      } else {
        setItems(list);
        setTotalCount(result.totalCount ?? result.TotalCount ?? 0);
      }
      await loadMeta();
    } catch (err) {
      setItems([]);
      setTotalCount(0);
      setCategories([]);
      setStats({ totalAnnouncements: 0, totalReads: 0, unreadByMe: 0 });
      setError(
        apiErrorMessage(err, "Unable to load announcements from the server.")
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filter, categoryId, sortBy, search, loadMeta]);

  const applySearch = useCallback((value) => {
    setPage(1);
    setSearch(String(value ?? "").trim());
  }, []);

  const refresh = useCallback(async () => {
    await loadList();
  }, [loadList]);

  const removeItemLocally = useCallback((announcementId) => {
    const id = String(announcementId);
    setItems((prev) =>
      prev.filter(
        (a) => String(a.announcementId ?? a.AnnouncementId) !== id
      )
    );
    setTotalCount((c) => Math.max(0, Number(c) - 1));
  }, []);

  const patchItemLocally = useCallback((announcementId, patch) => {
    const id = String(announcementId);
    setItems((prev) =>
      prev.map((a) =>
        String(a.announcementId ?? a.AnnouncementId) === id
          ? { ...a, ...patch }
          : a
      )
    );
  }, []);

  /** After create: show under All + Newest and reload immediately */
  const resetToAllNewest = useCallback(async () => {
    setPage(1);
    setFilter("all");
    setCategoryId(null);
    setSortBy("newest");
    setSearch("");
    setLoading(true);
    setError("");
    try {
      const result = await getAnnouncements({
        page: 1,
        pageSize,
        sortBy: "newest",
      });
      setItems(result.items || []);
      setTotalCount(result.totalCount ?? result.TotalCount ?? 0);
      await loadMeta();
    } catch (err) {
      setItems([]);
      setTotalCount(0);
      setError(
        apiErrorMessage(err, "Unable to load announcements from the server.")
      );
    } finally {
      setLoading(false);
    }
  }, [pageSize, loadMeta]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  return {
    loading,
    error,
    items,
    totalCount,
    page,
    setPage,
    pageSize,
    categories,
    stats,
    filter,
    setFilter: (value) => {
      setPage(1);
      setCategoryId(null); // avoid Organization + "IT Department" category clash
      setFilter(value);
    },
    categoryId,
    setCategoryId: (value) => {
      setPage(1);
      setCategoryId(value);
    },
    sortBy,
    setSortBy: (value) => {
      setPage(1);
      setSortBy(value);
    },
    search,
    setSearch,
    applySearch,
    refresh,
    removeItemLocally,
    patchItemLocally,
    loadList,
    loadMeta,
    resetToAllNewest,
  };
};

export default useAnnouncements;
