import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Row,
} from "reactstrap";
import { useLocation, useNavigate } from "react-router-dom";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import useAnnouncements from "./hooks/useAnnouncements";
import AnnouncementFilters from "./components/AnnouncementFilters";
import AnnouncementList from "./components/AnnouncementList";
import AnnouncementCategory from "./components/AnnouncementCategory";
import AnnouncementStats from "./components/AnnouncementStats";
import AnnouncementDetailsModal from "./components/AnnouncementDetailsModal";
import AnnouncementForm from "./components/AnnouncementForm";
import DeleteAnnouncementModal from "./components/DeleteAnnouncementModal";
import {
  pinAnnouncement,
  unpinAnnouncement,
  subscribeChatPresence,
  getAnnouncementById,
} from "./services/announcementService";
import { apiErrorMessage } from "./utils/announcementUtils";
import {
  CHAT_TAB,
  useTabPermission,
} from "../../../contexts/ChatPermissionsContext";
import "./styles/announcements.scss";

const Announcements = () => {
  document.title = "Announcements | Chat Module | SoftOnCloud";
  const location = useLocation();
  const navigate = useNavigate();
  const { canAdd, canEdit, canDelete } = useTabPermission(
    CHAT_TAB.ANNOUNCEMENTS
  );
  const openedFromNotifRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const {
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
    setFilter,
    categoryId,
    setCategoryId,
    sortBy,
    setSortBy,
    search,
    applySearch,
    refresh,
    removeItemLocally,
    patchItemLocally,
    resetToAllNewest,
    loadMeta,
  } = useAnnouncements();

  const [detailsItem, setDetailsItem] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [actionError, setActionError] = useState("");

  // Keep draft in sync when search is cleared elsewhere (e.g. after create)
  useEffect(() => {
    setSearchDraft(search || "");
  }, [search]);

  // Live search: debounce typing → applySearch (Enter / icon still work instantly)
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const draft = (searchDraft || "").trim();
    const applied = (search || "").trim();
    if (draft === applied) return undefined;

    searchDebounceRef.current = setTimeout(() => {
      setActionError("");
      applySearch(searchDraft);
    }, 350);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchDraft, search, applySearch]);

  // Notification bell click → open that announcement (works even if already on this page)
  useEffect(() => {
    const openId = location.state?.openAnnouncementId;
    const openTs = location.state?.openTs;
    if (!openId) return;
    const dedupeKey = `${openId}:${openTs || ""}`;
    if (openedFromNotifRef.current === dedupeKey) return;
    openedFromNotifRef.current = dedupeKey;

    let cancelled = false;
    const open = async () => {
      const match = (items || []).find(
        (a) =>
          String(a.announcementId ?? a.AnnouncementId) === String(openId)
      );
      if (match) {
        if (!cancelled) setDetailsItem(match);
      } else {
        try {
          await refresh();
          const detail = await getAnnouncementById(openId);
          if (!cancelled && detail) setDetailsItem(detail);
        } catch {
          // list refresh may still show it
        }
      }
      // Clear state so back/refresh does not reopen
      navigate(location.pathname, { replace: true, state: {} });
    };
    open();
    return () => {
      cancelled = true;
    };
  }, [location.state, location.pathname, items, refresh, navigate]);

  // Live sync via SignalR — Kenil create → demo user 2 list updates without refresh
  useEffect(() => {
    const unsubscribe = subscribeChatPresence((event, payload) => {
      if (event === "ReceiveNotification") {
        const type = String(
          payload?.notificationType ?? payload?.NotificationType ?? ""
        ).toUpperCase();
        const refType = String(
          payload?.referenceType ?? payload?.ReferenceType ?? ""
        ).toUpperCase();
        if (type === "ANNOUNCEMENT" || refType === "ANNOUNCEMENT") {
          refresh();
        }
        return;
      }

      if (event !== "AnnouncementChanged" || !payload) return;
      const action = String(payload.action || "").toLowerCase();
      const id = payload.announcementId ?? payload.AnnouncementId;
      if (!id) return;

      if (action === "deleted") {
        removeItemLocally(id);
        if (
          String(detailsItem?.announcementId ?? detailsItem?.AnnouncementId) ===
          String(id)
        ) {
          setDetailsItem(null);
        }
        if (
          String(editItem?.announcementId ?? editItem?.AnnouncementId) ===
          String(id)
        ) {
          setFormOpen(false);
          setEditItem(null);
        }
        loadMeta?.();
        return;
      }

      if (action === "pinned") {
        const pinned = Boolean(payload.isPinned ?? payload.IsPinned);
        patchItemLocally(id, { isPinned: pinned, IsPinned: pinned });
        return;
      }

      // created / updated
      refresh();
    });
    return unsubscribe;
  }, [
    refresh,
    removeItemLocally,
    patchItemLocally,
    loadMeta,
    detailsItem,
    editItem,
  ]);

  const openCreate = () => {
    setEditItem(null);
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setDetailsItem(null);
    setEditItem(item);
    setFormOpen(true);
  };

  const handleDeleteRequest = (item) => {
    setDetailsItem(null);
    setDeleteItem(item);
  };

  const handlePinToggle = async (item, shouldPin) => {
    const id = item?.announcementId ?? item?.AnnouncementId;
    if (!id) return;
    setActionError("");
    // Optimistic UI
    patchItemLocally(id, { isPinned: shouldPin, IsPinned: shouldPin });
    try {
      if (shouldPin) await pinAnnouncement(id);
      else await unpinAnnouncement(id);
      await refresh();
    } catch (err) {
      patchItemLocally(id, { isPinned: !shouldPin, IsPinned: !shouldPin });
      setActionError(apiErrorMessage(err, "Unable to update pin status."));
    }
  };

  const handleDeleted = async () => {
    const id = deleteItem?.announcementId ?? deleteItem?.AnnouncementId;
    if (id) removeItemLocally(id);
    setDeleteItem(null);
    setActionError("");
    try {
      await loadMeta?.();
      await refresh();
    } catch {
      // local remove already applied
    }
  };

  const handleFormSaved = async ({ created } = {}) => {
    setActionError("");
    if (created) {
      await resetToAllNewest();
    } else {
      await refresh();
    }
  };

  const displayError = actionError || error;

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Announcements" pageTitle="Chat" />

          <Row className="mb-3 pb-1">
            <Col xs={12}>
              <div className="d-flex align-items-lg-center flex-lg-row flex-column">
                <div className="flex-grow-1">
                  <h4 className="fs-16 mb-1">Company announcements</h4>
                  <p className="text-muted mb-0">
                    Browse, filter and manage organization announcements.
                  </p>
                </div>
                {canAdd ? (
                  <div className="mt-3 mt-lg-0">
                    <Button color="primary" onClick={openCreate}>
                      <i className="ri-add-line align-bottom me-1"></i>
                      New Announcement
                    </Button>
                  </div>
                ) : null}
              </div>
            </Col>
          </Row>

          {displayError ? (
            <Alert
              color="danger"
              className="mb-3"
              toggle={() => {
                setActionError("");
              }}
            >
              {displayError}
            </Alert>
          ) : null}

          <Row>
            <Col xl={9}>
              <Card>
                <CardHeader className="border-0">
                  <AnnouncementFilters
                    filter={filter}
                    onFilterChange={(value) => {
                      setActionError("");
                      setFilter(value);
                    }}
                    categoryId={categoryId}
                    categories={categories}
                    onCategoryChange={(value) => {
                      setActionError("");
                      setCategoryId(value);
                    }}
                    sortBy={sortBy}
                    onSortChange={(value) => {
                      setActionError("");
                      setSortBy(value);
                    }}
                    search={searchDraft}
                    onSearchChange={setSearchDraft}
                    onSearchSubmit={(value) => {
                      if (searchDebounceRef.current) {
                        clearTimeout(searchDebounceRef.current);
                      }
                      setActionError("");
                      const next = value ?? "";
                      setSearchDraft(next);
                      applySearch(next);
                    }}
                  />
                </CardHeader>
                <CardBody className="pt-0">
                  <AnnouncementList
                    loading={loading}
                    error=""
                    items={items}
                    page={page}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    onPageChange={setPage}
                    onViewDetails={(item) => setDetailsItem(item)}
                    onEdit={openEdit}
                    onDelete={handleDeleteRequest}
                    onPinToggle={handlePinToggle}
                    canAdd={canAdd}
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                </CardBody>
              </Card>
            </Col>

            <Col xl={3}>
              <AnnouncementCategory
                categories={categories}
                selectedCategoryId={categoryId}
                totalCount={stats.totalAnnouncements}
                onSelect={setCategoryId}
              />
              <AnnouncementStats stats={stats} />
            </Col>
          </Row>
        </Container>
      </div>

      <AnnouncementDetailsModal
        isOpen={Boolean(detailsItem)}
        announcementId={
          detailsItem?.announcementId ?? detailsItem?.AnnouncementId
        }
        onClose={() => setDetailsItem(null)}
        onEdit={canEdit ? openEdit : undefined}
        onDelete={canDelete ? handleDeleteRequest : undefined}
        onChanged={refresh}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <AnnouncementForm
        isOpen={formOpen}
        toggle={() => setFormOpen(false)}
        initial={editItem}
        onSaved={handleFormSaved}
      />

      <DeleteAnnouncementModal
        isOpen={Boolean(deleteItem)}
        announcement={deleteItem}
        onClose={() => setDeleteItem(null)}
        onDeleted={handleDeleted}
      />
    </React.Fragment>
  );
};

export default Announcements;
