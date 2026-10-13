import React, { useEffect, useRef, useState } from "react";
import { Card, CardBody } from "reactstrap";
import CommAvatar from "../../components/CommAvatar";
import {
  getSessionUserIdentity,
  resolveUserAvatarUrl,
} from "../services/announcementService";
import {
  formatAnnouncementDate,
  previewText,
  resolveAnnouncementStatus,
  statusBadgeClass,
} from "../utils/announcementUtils";
import { STATUS_TICK_MS } from "../constants/announcementConstants";

const themeColor = (cssVar, fallback) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar)
    .trim();
  return value || fallback;
};

const categoryIcon = (name = "") => {
  const n = String(name).toLowerCase();
  if (n.includes("hr"))
    return { icon: "ri-calendar-event-line", color: themeColor("--vz-success", "#0ab39c") };
  if (n.includes("finance"))
    return { icon: "ri-briefcase-line", color: themeColor("--vz-warning", "#f7b84b") };
  if (n.includes("it"))
    return { icon: "ri-macbook-line", color: themeColor("--vz-primary", "#405189") };
  if (n.includes("ops") || n.includes("operation"))
    return { icon: "ri-settings-3-line", color: themeColor("--vz-info", "#3577f1") };
  return { icon: "ri-megaphone-line", color: themeColor("--vz-primary", "#405189") };
};

/** Always visible ⋮ — opens View / Edit / Pin / Delete (owner gets all 4) */
const ActionsMenu = ({
  announcement,
  pinned,
  canManage,
  canEdit = false,
  canDelete = false,
  menuOpen,
  setMenuOpen,
  onViewDetails,
  onEdit,
  onDelete,
  onPinToggle,
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    // Use click (not mousedown) so menu item actions fire reliably
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [menuOpen, setMenuOpen]);

  const runAction = (e, action) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    action?.();
  };

  return (
    <div
      className={`comm-ann-card-actions position-relative d-inline-flex${
        menuOpen ? " is-open" : ""
      }`}
      ref={menuRef}
    >
      <button
        type="button"
        className="btn btn-ghost-secondary btn-icon btn-sm comm-ann-more-btn"
        aria-label="More actions"
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
      >
        <i className="ri-more-2-fill fs-16"></i>
      </button>
      {menuOpen ? (
        <div
          className="comm-ann-card-dropdown"
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="dropdown-item"
            role="menuitem"
            onClick={(e) => runAction(e, () => onViewDetails?.(announcement))}
          >
            View Details
          </button>
          {canEdit ? (
            <button
              type="button"
              className="dropdown-item"
              role="menuitem"
              onClick={(e) => runAction(e, () => onEdit?.(announcement))}
            >
              Edit
            </button>
          ) : null}
          {canManage ? (
            <button
              type="button"
              className="dropdown-item"
              role="menuitem"
              onClick={(e) =>
                runAction(e, () => onPinToggle?.(announcement, !pinned))
              }
            >
              {pinned ? "Unpin" : "Pin"}
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className="dropdown-item text-danger"
              role="menuitem"
              onClick={(e) => runAction(e, () => onDelete?.(announcement))}
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const AnnouncementCard = ({
  announcement,
  onViewDetails,
  onEdit,
  onDelete,
  onPinToggle,
  canManage = false,
  canEdit = false,
  canDelete = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Flip Active → Expired when expiry time passes (no full page reload needed)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), STATUS_TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (!announcement) return null;

  const me = getSessionUserIdentity();
  const title = announcement.title ?? announcement.Title ?? "";
  const description = announcement.description ?? announcement.Description ?? "";
  const category = announcement.categoryName ?? announcement.CategoryName ?? "";
  const department =
    announcement.departmentName ?? announcement.DepartmentName ?? "";
  const important = Boolean(announcement.isImportant ?? announcement.IsImportant);
  const pinned = Boolean(announcement.isPinned ?? announcement.IsPinned);
  const postedBy = announcement.postedBy ?? announcement.PostedBy;
  const isPosterMe =
    me?.userId != null && String(postedBy) === String(me.userId);
  const author = isPosterMe
    ? me.displayName || announcement.postedByName || announcement.PostedByName || "You"
    : announcement.postedByName ?? announcement.PostedByName ?? "User";
  const role =
    announcement.postedByRole ||
    (isPosterMe ? me.jobTitle || me.role || "" : "");
  const avatarSrc = resolveUserAvatarUrl(
    postedBy,
    announcement.postedByAvatar ??
      announcement.PostedByAvatar ??
      announcement.profileImageUrl ??
      (isPosterMe ? me.profileImage : null)
  );
  const date = formatAnnouncementDate(
    announcement.postedDate ?? announcement.PostedDate
  );
  const readCount = Number(announcement.readCount ?? announcement.ReadCount ?? 0);
  const recipientCount = Number(
    announcement.recipientCount ?? announcement.RecipientCount ?? 0
  );
  const statusName = resolveAnnouncementStatus(announcement, now);
  const badge = statusBadgeClass(statusName);
  const { icon, color } = categoryIcon(category || department);
  const scopeLabel = department
    ? department
    : announcement.location || announcement.Location
      ? announcement.location || announcement.Location
      : category || "Organization Wide";

  const menu = (
    <ActionsMenu
      announcement={announcement}
      pinned={pinned}
      canManage={canManage}
      canEdit={canEdit}
      canDelete={canDelete}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      onViewDetails={onViewDetails}
      onEdit={onEdit}
      onDelete={onDelete}
      onPinToggle={onPinToggle}
    />
  );

  const authorBlock = (
    <div className="d-flex align-items-center gap-2">
      <CommAvatar id={postedBy || me?.userId || 1} src={avatarSrc} size="xs" />
      <div>
        <span className="fw-medium fs-13">{author}</span>
        {role ? <span className="text-muted fs-12"> · {role}</span> : null}
        <div className="text-muted fs-12">{date}</div>
      </div>
    </div>
  );

  if (pinned) {
    return (
      <Card
        className={`mb-3 comm-ann-card comm-ann-card-pinned border shadow-sm${
          menuOpen ? " is-menu-open" : ""
        }`}
      >
        <CardBody>
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div className="d-flex flex-wrap gap-2">
              <span className="badge comm-ann-pinned-badge bg-primary-subtle text-primary">
                <i className="ri-pushpin-fill me-1"></i>Pinned
              </span>
              {scopeLabel ? (
                <span className="badge bg-primary-subtle text-primary">
                  {scopeLabel}
                </span>
              ) : null}
              {important ? (
                <span className="badge bg-danger-subtle text-danger">
                  Important
                </span>
              ) : null}
            </div>
            <div className="d-flex align-items-center gap-1">
              <button
                type="button"
                className="btn btn-ghost-primary btn-icon btn-sm"
                title={canManage ? "Unpin" : "Pinned"}
                disabled={!canManage}
                onClick={() => canManage && onPinToggle?.(announcement, false)}
              >
                <i className="ri-pushpin-fill text-primary fs-16"></i>
              </button>
              {menu}
            </div>
          </div>
          <div className="d-flex gap-3">
            <span className="avatar-md flex-shrink-0">
              <span
                className="avatar-title rounded-3 fs-2"
                style={{ background: `${color}22`, color }}
              >
                <i className={icon}></i>
              </span>
            </span>
            <div className="flex-grow-1 min-w-0">
              <h5 className="fw-semibold mb-1">{title}</h5>
              <p className="text-muted mb-3">{previewText(description, 220)}</p>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                {authorBlock}
                <div className="d-flex align-items-center gap-3">
                  <span className="text-muted fs-12">
                    <i className="ri-eye-line me-1"></i>
                    {readCount} / {recipientCount} read
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => onViewDetails?.(announcement)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div
      className={`comm-ann-card d-flex align-items-start gap-3 py-3 border-bottom${
        menuOpen ? " is-menu-open" : ""
      }`}
    >
      <span className="avatar-sm flex-shrink-0">
        <span
          className="avatar-title rounded fs-4"
          style={{ background: `${color}22`, color }}
        >
          <i className={icon}></i>
        </span>
      </span>
      <div className="flex-grow-1 min-w-0">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
          <span className="badge bg-primary-subtle text-primary">
            {category || scopeLabel}
          </span>
          {important ? (
            <span className="badge bg-danger-subtle text-danger">Important</span>
          ) : null}
        </div>
        <h6 className="mb-1">{title}</h6>
        <p className="text-muted fs-13 mb-2">{previewText(description)}</p>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          {authorBlock}
          <div className="d-flex align-items-center gap-2">
            {statusName ? (
              <span className={`badge bg-${badge.bg}-subtle text-${badge.text}`}>
                {statusName}
              </span>
            ) : null}
            <span className="text-muted fs-12">
              {readCount} / {recipientCount} read
            </span>
          </div>
        </div>
      </div>
      <div className="comm-ann-card-meta text-end flex-shrink-0">{menu}</div>
    </div>
  );
};

export default AnnouncementCard;
