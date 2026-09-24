import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "reactstrap";
import CommAvatar from "../../components/CommAvatar";
import {
  getAnnouncementById,
  markAnnouncementRead,
  pinAnnouncement,
  unpinAnnouncement,
  getSessionUserIdentity,
  resolveUserAvatarUrl,
} from "../services/announcementService";
import {
  apiErrorMessage,
  formatAnnouncementDate,
  statusBadgeClass,
} from "../utils/announcementUtils";

const AnnouncementDetailsModal = ({
  isOpen,
  announcementId,
  onClose,
  onEdit,
  onDelete,
  onChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [item, setItem] = useState(null);
  const me = useMemo(() => getSessionUserIdentity(), []);

  const load = async () => {
    if (!announcementId) return;
    setLoading(true);
    setError("");
    try {
      const data = await getAnnouncementById(announcementId);
      setItem(data);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to load announcement."));
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (announcementId) load();
    else {
      setItem(null);
      setError("");
    }
  }, [isOpen, announcementId]);

  const isPoster =
    item &&
    me?.userId &&
    String(item.postedBy ?? item.PostedBy) === String(me.userId);

  const handleMarkRead = async () => {
    setBusy("read");
    try {
      await markAnnouncementRead(announcementId);
      await load();
      onChanged?.();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy("");
    }
  };

  const handlePinToggle = async () => {
    const pinned = Boolean(item?.isPinned ?? item?.IsPinned);
    setBusy("pin");
    try {
      if (pinned) await unpinAnnouncement(announcementId);
      else await pinAnnouncement(announcementId);
      await load();
      onChanged?.();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy("");
    }
  };

  const statusName = item?.statusName ?? item?.StatusName ?? "";
  const badge = statusBadgeClass(statusName);
  const posterName = item?.postedByName ?? item?.PostedByName ?? "User";
  const postedBy = item?.postedBy ?? item?.PostedBy;
  const isPinned = Boolean(item?.isPinned ?? item?.IsPinned);

  return (
    <Modal isOpen={isOpen} toggle={onClose} centered size="lg">
      <ModalHeader toggle={onClose}>Announcement details</ModalHeader>
      <ModalBody>
        {loading ? (
          <div className="text-center py-4 text-muted">
            <Spinner size="sm" className="me-2" />
            Loading...
          </div>
        ) : error ? (
          <div className="alert alert-danger mb-0">{error}</div>
        ) : item ? (
          <>
            <div className="d-flex flex-wrap gap-2 mb-2">
              {isPinned ? (
                <span className="badge bg-primary-subtle text-primary">
                  <i className="ri-pushpin-fill me-1"></i>Pinned
                </span>
              ) : null}
              {(item.isImportant ?? item.IsImportant) ? (
                <span className="badge bg-danger-subtle text-danger">Important</span>
              ) : null}
              {(item.categoryName ?? item.CategoryName) ? (
                <span className="badge bg-primary-subtle text-primary">
                  {item.categoryName ?? item.CategoryName}
                </span>
              ) : null}
              {statusName ? (
                <span className={`badge bg-${badge.bg}-subtle text-${badge.text}`}>
                  {statusName}
                </span>
              ) : null}
            </div>
            <h4 className="mb-2">{item.title ?? item.Title}</h4>
            <p className="text-muted mb-3" style={{ whiteSpace: "pre-wrap" }}>
              {item.description ?? item.Description}
            </p>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <div className="d-flex align-items-center gap-2">
                <CommAvatar
                  id={postedBy || me?.userId || 1}
                  src={resolveUserAvatarUrl(
                    postedBy,
                    item?.postedByAvatar ??
                      item?.PostedByAvatar ??
                      (String(postedBy) === String(me?.userId)
                        ? me?.profileImage
                        : null)
                  )}
                  size="sm"
                />
                <div>
                  <div className="fs-13">
                    Posted by <strong>{posterName}</strong>
                  </div>
                  <div className="fs-13 text-muted">
                    {formatAnnouncementDate(item.postedDate ?? item.PostedDate)}
                  </div>
                </div>
              </div>
              <div className="fs-13 text-muted">
                {(item.readCount ?? item.ReadCount ?? 0)} /{" "}
                {(item.recipientCount ?? item.RecipientCount ?? 0)} read
              </div>
            </div>
          </>
        ) : null}
      </ModalBody>
      <ModalFooter className="flex-wrap gap-2">
        {item && !(item.isReadByCurrentUser ?? item.IsReadByCurrentUser) ? (
          <Button color="success" disabled={!!busy} onClick={handleMarkRead}>
            {busy === "read" ? "Saving..." : "Mark as Read"}
          </Button>
        ) : null}
        {isPoster ? (
          <Button color="soft-primary" disabled={!!busy} onClick={handlePinToggle}>
            <i
              className={`${isPinned ? "ri-pushpin-fill" : "ri-pushpin-line"} align-bottom me-1`}
            ></i>
            {busy === "pin" ? "Saving..." : isPinned ? "Unpin" : "Pin"}
          </Button>
        ) : null}
        {isPoster ? (
          <Button color="soft-secondary" onClick={() => onEdit?.(item)}>
            Edit
          </Button>
        ) : null}
        {isPoster ? (
          <Button color="danger" outline onClick={() => onDelete?.(item)}>
            Delete
          </Button>
        ) : null}
        <Button color="light" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default AnnouncementDetailsModal;
