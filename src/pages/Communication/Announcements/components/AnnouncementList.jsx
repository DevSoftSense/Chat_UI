import React from "react";
import { Spinner } from "reactstrap";
import AnnouncementCard from "./AnnouncementCard";
import {
  getSessionUserIdentity,
} from "../services/announcementService";

const AnnouncementList = ({
  loading,
  error,
  items = [],
  onViewDetails,
  onEdit,
  onDelete,
  onPinToggle,
  page,
  pageSize,
  totalCount,
  onPageChange,
}) => {
  const me = getSessionUserIdentity();

  if (loading) {
    return (
      <div className="text-center text-muted py-5">
        <Spinner size="sm" className="me-2" />
        Loading announcements...
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center text-muted py-5">
        No announcements found.
      </div>
    );
  }

  const pinned = items.filter((a) => a.isPinned || a.IsPinned);
  const rest = items.filter((a) => !(a.isPinned || a.IsPinned));
  const totalPages = Math.max(1, Math.ceil((totalCount || items.length) / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount || items.length);

  const canManage = (item) =>
    me?.userId &&
    String(item.postedBy ?? item.PostedBy) === String(me.userId);

  const renderCard = (item, keyPrefix = "") => (
    <AnnouncementCard
      key={`${keyPrefix}${item.announcementId ?? item.AnnouncementId}`}
      announcement={item}
      onViewDetails={onViewDetails}
      onEdit={onEdit}
      onDelete={onDelete}
      onPinToggle={onPinToggle}
      canManage={canManage(item)}
    />
  );

  return (
    <>
      {pinned.map((item) => renderCard(item, "p-"))}
      {rest.map((item) => renderCard(item))}
      {totalCount > 0 ? (
        <div className="comm-ann-pagination d-flex justify-content-between align-items-center mt-3 pt-3">
          <span className="comm-ann-pagination-info fs-13">
            {from}-{to} of {totalCount} announcements
          </span>
          {totalPages > 1 ? (
            <div className="btn-group comm-ann-pagination-btns" role="group">
              <button
                type="button"
                className="btn btn-soft-primary btn-sm"
                disabled={page <= 1}
                onClick={() => onPageChange?.(page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-soft-primary btn-sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange?.(page + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
};

export default AnnouncementList;
