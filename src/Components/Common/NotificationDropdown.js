import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Col,
  Dropdown,
  DropdownMenu,
  DropdownToggle,
  Nav,
  NavItem,
  NavLink,
  Row,
  TabContent,
  TabPane,
} from "reactstrap";
import { Link, useNavigate, useLocation } from "react-router-dom";
import classnames from "classnames";
import SimpleBar from "simplebar-react";
import bell from "../../assets/images/svg/bell.svg";
import {
  getChatNotifications,
  markChatNotificationRead,
  subscribeChatPresence,
} from "../../helpers/softoncloud_auth_helper";

const CHAT_UI_STORAGE_KEY = "chatUiState";

const writeChatUiState = (patch) => {
  try {
    const prev = JSON.parse(sessionStorage.getItem(CHAT_UI_STORAGE_KEY) || "null") || {};
    sessionStorage.setItem(
      CHAT_UI_STORAGE_KEY,
      JSON.stringify({ ...prev, ...patch })
    );
  } catch {
    // ignore
  }
};

const normalizeNotification = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.notificationId ?? raw.NotificationId;
  if (id == null) return null;
  const referenceType = String(
    raw.referenceType ?? raw.ReferenceType ?? ""
  );
  const referenceEntity = String(
    raw.referenceEntity ?? raw.ReferenceEntity ?? ""
  );
  const groupIdRaw = raw.groupId ?? raw.GroupId;
  let groupId =
    groupIdRaw != null && groupIdRaw !== ""
      ? Number(groupIdRaw)
      : null;
  if (!(Number.isFinite(groupId) && groupId > 0) && referenceType) {
    const match = /^GROUP:(\d+)$/i.exec(referenceType.trim());
    if (match) groupId = Number(match[1]);
  }
  if (!(Number.isFinite(groupId) && groupId > 0)) groupId = null;

  return {
    notificationId: Number(id),
    notificationType: String(
      raw.notificationType ?? raw.NotificationType ?? ""
    ).toUpperCase(),
    title: raw.title ?? raw.Title ?? "Notification",
    message: raw.message ?? raw.Message ?? "",
    referenceId: raw.referenceId ?? raw.ReferenceId ?? null,
    referenceType: referenceType || null,
    referenceEntity: referenceEntity || null,
    senderUserId: raw.senderUserId ?? raw.SenderUserId ?? null,
    groupId,
    createdDate: raw.createdDate ?? raw.CreatedDate ?? null,
    isRead: Boolean(raw.isRead ?? raw.IsRead),
  };
};

/** Announcement alert → open /communication/announcements */
const isAnnouncementNotification = (item) => {
  if (!item) return false;
  const type = String(item.notificationType || "").toUpperCase();
  const refType = String(item.referenceType || "").toUpperCase();
  const refEntity = String(item.referenceEntity || "").toLowerCase();
  const title = String(item.title || "").toLowerCase();
  if (type === "ANNOUNCEMENT" || refType === "ANNOUNCEMENT") return true;
  if (refEntity.includes("announcement")) return true;
  if (title.includes("announcement")) return true;
  return false;
};

const openAnnouncementsPage = (navigate, location, openAnnouncementId) => {
  const state = {
    openAnnouncementId:
      openAnnouncementId != null && openAnnouncementId !== ""
        ? String(openAnnouncementId)
        : null,
    openTs: Date.now(),
  };
  const onAnnouncements = String(location.pathname || "")
    .toLowerCase()
    .includes("/communication/announcements");
  if (onAnnouncements) {
    navigate(location.pathname, { replace: true, state });
  } else {
    navigate("/communication/announcements", { state });
  }
};

const formatRelativeTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hrs ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const NotificationDropdown = () => {
  const navigate = useNavigate();
  const location = useLocation();
    const [isNotificationDropdown, setIsNotificationDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState("1");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

    const toggleTab = (tab) => {
    if (activeTab !== tab) setActiveTab(tab);
  };

  const applyListResult = useCallback((result) => {
    const list = Array.isArray(result?.notifications)
      ? result.notifications.map(normalizeNotification).filter(Boolean)
      : [];
    // Bell dropdown shows unread only — click clears them from the list
    const unreadOnly = list.filter((n) => !n.isRead);
    setNotifications(unreadOnly);
    const apiUnread = Number(result?.unreadCount);
    setUnreadCount(
      Number.isFinite(apiUnread)
        ? Math.max(0, apiUnread)
        : unreadOnly.length
    );
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getChatNotifications();
      applyListResult(result);
    } catch (err) {
      setError(err?.message || "Failed to load notifications.");
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [applyListResult]);

  const toggleNotificationDropdown = () => {
    setIsNotificationDropdown((open) => {
      const next = !open;
      if (next) {
        // Refresh on open so announcement alerts appear after login / other tab create
        loadNotifications();
      }
      return next;
    });
  };

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Shared SignalR hub — ReceiveNotification (no duplicate connection)
  useEffect(() => {
    const unsubscribe = subscribeChatPresence((event, payload) => {
      if (event !== "ReceiveNotification") return;
      const next = normalizeNotification(payload);
      if (!next?.notificationId) return;

      setNotifications((prev) => {
        if (prev.some((n) => n.notificationId === next.notificationId)) {
          return prev;
        }
        return [next, ...prev];
      });
      if (!next.isRead) {
        setUnreadCount((count) => Math.max(0, Number(count) || 0) + 1);
      }
    });
    return unsubscribe;
  }, []);

  const messageNotifications = useMemo(
    () => notifications.filter((n) => n.notificationType === "MESSAGE"),
    [notifications]
  );

  const alertNotifications = useMemo(
    () =>
      notifications.filter(
        (n) => n.notificationType && n.notificationType !== "MESSAGE"
      ),
    [notifications]
  );

  const openRelatedChat = (item) => {
    // Announcement notification → Announcements page (+ open that item)
    if (isAnnouncementNotification(item)) {
      openAnnouncementsPage(navigate, location, item.referenceId);
      return;
    }

    if (item?.notificationType !== "MESSAGE") return;

    const focusMessageId = item.referenceId;

    // Group message notification → Groups page
    if (item.groupId != null) {
      writeChatUiState({
        openGroupId: String(item.groupId),
        focusMessageId:
          focusMessageId != null && focusMessageId !== ""
            ? String(focusMessageId)
            : null,
      });
      navigate("/communication/groups", {
        state: {
          openGroupId: String(item.groupId),
          focusMessageId:
            focusMessageId != null && focusMessageId !== ""
              ? String(focusMessageId)
              : null,
        },
      });
      return;
    }

    // Peer = sender of the message notification (dynamic, never hardcoded)
    const peerUserId = item.senderUserId;

    if (peerUserId == null || peerUserId === "") return;

    writeChatUiState({
      activeUserId: String(peerUserId),
      focusMessageId:
        focusMessageId != null && focusMessageId !== ""
          ? String(focusMessageId)
          : null,
    });

    navigate("/communication/messages", {
      state: {
        openPeerUserId: String(peerUserId),
        focusMessageId:
          focusMessageId != null && focusMessageId !== ""
            ? String(focusMessageId)
            : null,
      },
    });
  };

  const handleOpenNotification = async (item) => {
    if (!item?.notificationId) return;

    const wasUnread = !item.isRead;
    const notificationId = item.notificationId;

    // Close dropdown immediately
    setIsNotificationDropdown(false);

    // Clear from list + decrease bell count (optimistic)
    setNotifications((prev) =>
      prev.filter((n) => n.notificationId !== notificationId)
    );
    if (wasUnread) {
      setUnreadCount((count) => Math.max(0, (Number(count) || 0) - 1));
    }

    // Persist read in DB (source of truth for refresh)
    if (wasUnread) {
      try {
        const result = await markChatNotificationRead(notificationId);
        if (result && typeof result.unreadCount === "number") {
          setUnreadCount(Math.max(0, result.unreadCount));
        }
      } catch (err) {
        // Keep cleared in UI; user already acted. Show soft error.
        setError(err?.message || "Failed to mark notification as read.");
      }
    }

    openRelatedChat(item);
  };

  const renderNotificationItem = (item) => {
    const isMessage = item.notificationType === "MESSAGE" && !isAnnouncementNotification(item);
    const isAnnouncement = isAnnouncementNotification(item);
    const itemLink = isAnnouncement
      ? "/communication/announcements"
      : item.groupId != null
        ? "/communication/groups"
        : "/communication/messages";
    return (
      <div
        key={item.notificationId}
        className={classnames(
          "text-reset notification-item d-block dropdown-item position-relative",
          { active: !item.isRead }
        )}
        role="button"
        tabIndex={0}
        onClick={() => handleOpenNotification(item)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpenNotification(item);
          }
        }}
      >
        <div className="d-flex">
          <div className="avatar-xs me-3">
            <span
              className={classnames(
                "avatar-title rounded-circle fs-16",
                isAnnouncement
                  ? "bg-primary-subtle text-primary"
                  : isMessage
                    ? "bg-danger-subtle text-danger"
                    : "bg-info-subtle text-info"
              )}
            >
              <i
                className={
                  isAnnouncement
                    ? "bx bx-megaphone"
                    : isMessage
                      ? "bx bx-message-square-dots"
                      : "bx bx-badge-check"
                }
              ></i>
            </span>
          </div>
          <div className="flex-grow-1">
            <Link
              to={itemLink}
              className="stretched-link"
              onClick={(e) => e.preventDefault()}
            >
              <h6 className="mt-0 mb-1 fs-13 fw-semibold">{item.title}</h6>
            </Link>
            <div className="fs-13 text-muted">
              <p className="mb-1">{item.message}</p>
            </div>
            <p className="mb-0 fs-11 fw-medium text-uppercase text-muted">
              <span>
                <i className="mdi mdi-clock-outline"></i>{" "}
                {formatRelativeTime(item.createdDate)}
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderList = (items, emptyTitle, viewAllTo = "/communication/messages") => {
    if (loading) {
      return (
        <div className="text-center text-muted py-4 fs-13">Loading...</div>
      );
    }
    if (error && !items.length) {
      return (
        <div className="text-center text-danger py-4 px-3 fs-13">{error}</div>
      );
    }
    if (!items.length) {
      return (
        <div className="p-4">
          <div className="w-25 w-sm-50 pt-3 mx-auto">
            <img src={bell} className="img-fluid" alt="notifications" />
          </div>
          <div className="text-center pb-5 mt-2">
            <h6 className="fs-18 fw-semibold lh-base">{emptyTitle}</h6>
            <button
              type="button"
              className="btn btn-soft-primary btn-sm mt-2"
              onClick={() => {
                setIsNotificationDropdown(false);
                navigate("/communication/announcements");
              }}
            >
              Go to Announcements
            </button>
          </div>
        </div>
      );
    }
    return (
      <SimpleBar style={{ maxHeight: "300px" }} className="pe-2">
        {items.map(renderNotificationItem)}
        <div className="my-3 text-center">
          <button
            type="button"
            className="btn btn-soft-success waves-effect waves-light"
            onClick={() => {
              setIsNotificationDropdown(false);
              navigate(viewAllTo);
            }}
          >
            View All Notifications{" "}
            <i className="ri-arrow-right-line align-middle"></i>
          </button>
        </div>
      </SimpleBar>
    );
  };

  const badgeLabel = unreadCount > 0 ? String(unreadCount) : null;

    return (
        <React.Fragment>
      <Dropdown
        isOpen={isNotificationDropdown}
        toggle={toggleNotificationDropdown}
        className="topbar-head-dropdown ms-1 header-item"
      >
        <DropdownToggle
          type="button"
          tag="button"
          className="btn btn-icon btn-topbar btn-ghost-secondary rounded-circle"
        >
          <i className="bx bx-bell fs-22"></i>
          {badgeLabel && (
            <span className="position-absolute topbar-badge fs-10 translate-middle badge rounded-pill bg-danger">
              {badgeLabel}
              <span className="visually-hidden">unread notifications</span>
            </span>
          )}
                </DropdownToggle>
                <DropdownMenu className="dropdown-menu-lg dropdown-menu-end p-0">
                    <div className="dropdown-head bg-primary bg-pattern rounded-top">
                        <div className="p-3">
                            <Row className="align-items-center">
                                <Col>
                  <h6 className="m-0 fs-16 fw-semibold text-white">
                    Notifications
                  </h6>
                                </Col>
                                <div className="col-auto dropdown-tabs">
                  <span className="badge bg-light-subtle text-body fs-13">
                    {unreadCount} New
                  </span>
                                </div>
                            </Row>
                        </div>

                        <div className="px-2 pt-2">
                            <Nav className="nav-tabs dropdown-tabs nav-tabs-custom">
                                <NavItem>
                                    <NavLink
                                        href="#"
                    className={classnames({ active: activeTab === "1" })}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleTab("1");
                    }}
                  >
                    All ({notifications.length})
                                    </NavLink>
                                </NavItem>
                                <NavItem>
                                    <NavLink
                                        href="#"
                    className={classnames({ active: activeTab === "2" })}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleTab("2");
                    }}
                                    >
                                        Messages
                                    </NavLink>
                                </NavItem>
                                <NavItem>
                                    <NavLink
                                        href="#"
                    className={classnames({ active: activeTab === "3" })}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleTab("3");
                    }}
                                    >
                                        Alerts
                                    </NavLink>
                                </NavItem>
                            </Nav>
                        </div>
                    </div>

                    <TabContent activeTab={activeTab}>
                        <TabPane tabId="1" className="py-2 ps-2">
              {renderList(
                notifications,
                "Hey! You have no any notifications",
                notifications.some(isAnnouncementNotification) &&
                  !notifications.some((n) => n.notificationType === "MESSAGE")
                  ? "/communication/announcements"
                  : "/communication/messages"
              )}
                        </TabPane>
                        <TabPane tabId="2" className="py-2 ps-2">
              {renderList(
                messageNotifications,
                "Hey! You have no any notifications",
                "/communication/messages"
              )}
                        </TabPane>
                        <TabPane tabId="3" className="p-4">
              {alertNotifications.length
                ? renderList(
                    alertNotifications,
                    "Hey! You have no any notifications",
                    "/communication/announcements"
                  )
                : (
                    <>
                            <div className="w-25 w-sm-50 pt-3 mx-auto">
                        <img src={bell} className="img-fluid" alt="alerts" />
                            </div>
                            <div className="text-center pb-5 mt-2">
                        <h6 className="fs-18 fw-semibold lh-base">
                          Hey! You have no any notifications
                        </h6>
                        <button
                          type="button"
                          className="btn btn-soft-primary btn-sm mt-2"
                          onClick={() => {
                            setIsNotificationDropdown(false);
                            navigate("/communication/announcements");
                          }}
                        >
                          Go to Announcements
                        </button>
                            </div>
                    </>
                  )}
                        </TabPane>
                    </TabContent>
                </DropdownMenu>
            </Dropdown>
        </React.Fragment>
    );
};

export default NotificationDropdown;
