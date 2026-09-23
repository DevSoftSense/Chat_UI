import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Offcanvas, OffcanvasBody, Spinner } from "reactstrap";
import SimpleBar from "simplebar-react";
import classnames from "classnames";
import {
  getChatMessageInfo,
  markChatMessagesRead,
  resolveUserAvatarUrl,
  subscribeChatPresence,
} from "../../../helpers/softoncloud_auth_helper";

/** WhatsApp-style receipt time: "Yesterday at 7:02 pm" */
export const formatMessageInfoWhen = (value) => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startToday - startThat) / 86400000);
  const timePart = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (dayDiff === 0) return timePart;
  if (dayDiff === 1) return `Yesterday at ${timePart}`;
  return `${d.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })} at ${timePart}`;
};

const apiErrorMessage = (error, fallback) =>
  error?.message ||
  error?.data?.message ||
  error?.response?.data?.message ||
  fallback;

/**
 * Hook: Group Message Info state, API load, and SignalR live updates.
 * Place all Message Info logic here (Groups folder).
 */
export const useGroupMessageInfo = ({
  me,
  mergedMembers = [],
  activeChatId = null,
  onBeforeOpen = null,
  onError = null,
} = {}) => {
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const messageRef = useRef(null);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  const close = useCallback(() => {
    setMessage(null);
    setMembers([]);
    setLoading(false);
  }, []);

  const clearIfMessage = useCallback((messageId) => {
    if (
      messageRef.current &&
      String(messageRef.current.id) === String(messageId)
    ) {
      setMessage(null);
      setMembers([]);
    }
  }, []);

  const open = useCallback(
    async (msg) => {
      if (!msg?.id) return;
      setMessage(msg);
      setLoading(true);
      if (typeof onBeforeOpen === "function") onBeforeOpen();

      const senderId = String(
        msg.senderUserId ??
          msg.raw?.senderUserId ??
          msg.raw?.SenderUserId ??
          (msg.from === "me" ? me?.userId : "") ??
          ""
      );

      const seed = (mergedMembers || [])
        .filter((m) => m && m.isActive !== false)
        .filter((m) => String(m.userId) !== senderId)
        .map((m) => ({
          userId: m.userId,
          name: m.isSelf ? "You" : m.name || `User ${m.userId}`,
          avatarSrc: m.avatarSrc || resolveUserAvatarUrl(m.userId, null),
          deliveredAt: null,
          readAt: null,
        }));
      setMembers(seed);

      try {
        const isMine =
          String(senderId) === String(me?.userId ?? "") || msg.from === "me";
        if (!isMine && activeChatId) {
          await markChatMessagesRead(activeChatId).catch(() => {});
        }

        const info = await getChatMessageInfo(msg.id);
        const receiptById = new Map(
          (info?.members || []).map((row) => [String(row.userId), row])
        );
        const fromApiOnly = (info?.members || [])
          .filter(
            (row) =>
              !seed.some((s) => String(s.userId) === String(row.userId)) &&
              String(row.userId) !== senderId
          )
          .map((row) => {
            const member = (mergedMembers || []).find(
              (m) => String(m.userId) === String(row.userId)
            );
            return {
              userId: row.userId,
              name: member?.isSelf
                ? "You"
                : member?.name || `User ${row.userId}`,
              avatarSrc:
                member?.avatarSrc || resolveUserAvatarUrl(row.userId, null),
              deliveredAt: row.deliveredAt || null,
              readAt: row.readAt || null,
            };
          });

        setMembers([
          ...seed.map((m) => {
            const row = receiptById.get(String(m.userId));
            return {
              ...m,
              deliveredAt: row?.deliveredAt || null,
              readAt: row?.readAt || null,
            };
          }),
          ...fromApiOnly,
        ]);
      } catch (error) {
        if (typeof onError === "function") {
          onError(apiErrorMessage(error, "Unable to load message info."));
        }
      } finally {
        setLoading(false);
      }
    },
    [mergedMembers, me?.userId, activeChatId, onBeforeOpen, onError]
  );

  // Live Delivered / Read while Message Info is open (shared SignalR hub).
  useEffect(() => {
    const unsubscribe = subscribeChatPresence((event, payload) => {
      if (!payload) return;
      const openMsg = messageRef.current;
      if (!openMsg?.id) return;

      if (event === "MessageDelivered") {
        const deliveredMessageId = String(
          payload.messageId ?? payload.MessageId ?? ""
        );
        if (deliveredMessageId !== String(openMsg.id)) return;
        const receiverId = String(
          payload.receiverUserId ?? payload.ReceiverUserId ?? ""
        );
        if (!receiverId) return;
        const when =
          payload.deliveredAt ??
          payload.DeliveredAt ??
          new Date().toISOString();
        setMembers((prev) =>
          prev.map((m) =>
            String(m.userId) === receiverId
              ? { ...m, deliveredAt: m.deliveredAt || when }
              : m
          )
        );
        return;
      }

      if (event === "MessagesRead") {
        const ids = Array.isArray(payload.messageIds)
          ? payload.messageIds
          : Array.isArray(payload.MessageIds)
            ? payload.MessageIds
            : [];
        if (!ids.map(String).includes(String(openMsg.id))) return;
        const readerId = String(
          payload.readerUserId ?? payload.ReaderUserId ?? ""
        );
        if (!readerId) return;
        const when =
          payload.readAt ?? payload.ReadAt ?? new Date().toISOString();
        setMembers((prev) =>
          prev.map((m) =>
            String(m.userId) === readerId
              ? {
                  ...m,
                  deliveredAt: m.deliveredAt || when,
                  readAt: when,
                }
              : m
          )
        );
      }
    });
    return unsubscribe;
  }, []);

  return {
    message,
    members,
    loading,
    open,
    close,
    clearIfMessage,
    messageRef,
  };
};

/**
 * Group Message Info panel UI — Read by / Delivered to / Remaining.
 */
const MessageInfo = ({ message, members = [], loading = false, onClose }) => {
  const readMembers = useMemo(
    () => (members || []).filter((m) => m.readAt),
    [members]
  );
  const deliveredMembers = useMemo(
    () => (members || []).filter((m) => m.deliveredAt && !m.readAt),
    [members]
  );
  const remainingMembers = useMemo(
    () => (members || []).filter((m) => !m.deliveredAt && !m.readAt),
    [members]
  );
  const anyRead = readMembers.length > 0;

  return (
    <Offcanvas
      isOpen={Boolean(message)}
      direction="end"
      toggle={onClose}
      className="offcanvas-end border-0 comm-group-info comm-msg-info"
      tabIndex="-1"
    >
      <OffcanvasBody className="p-0 d-flex flex-column">
        <div className="comm-gi-header">
          <button
            type="button"
            className="btn btn-ghost-secondary btn-icon btn-sm"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="ri-close-line fs-18"></i>
          </button>
          <h5 className="comm-gi-title mb-0 flex-grow-1">Message info</h5>
        </div>

        {message ? (
          <>
            <div className="comm-mi-preview">
              <div
                className={classnames("comm-mi-bubble", {
                  "is-mine": message.from === "me",
                })}
              >
                {message.type === "file" ||
                message.type === "image" ||
                message.type === "video" ||
                message.type === "audio" ? (
                  <div className="comm-mi-bubble-file">
                    <i className="ri-file-text-line me-1"></i>
                    <span className="text-truncate">
                      {message.fileName ||
                        message.mediaSubtype ||
                        "Attachment"}
                    </span>
                  </div>
                ) : (
                  <div className="comm-mi-bubble-text">
                    {message.text || "—"}
                  </div>
                )}
                <div className="comm-mi-bubble-meta">
                  <span>
                    {message.sentAt
                      ? formatMessageInfoWhen(message.sentAt)
                      : message.time || ""}
                  </span>
                  {message.from === "me" ? (
                    <i
                      className={classnames("ri-check-double-line ms-1", {
                        "text-primary": anyRead,
                      })}
                    ></i>
                  ) : null}
                </div>
              </div>
            </div>

            <SimpleBar className="comm-gi-scroll flex-grow-1">
              {loading ? (
                <div className="text-center py-5 text-muted">
                  <Spinner size="sm" className="me-2" />
                  Loading...
                </div>
              ) : (
                <>
                  <div className="comm-mi-section">
                    <div className="comm-mi-section-title">
                      <i className="ri-check-double-line text-primary me-1"></i>
                      Read by
                      <span className="comm-mi-count ms-1">
                        {readMembers.length}
                      </span>
                    </div>
                    {readMembers.length === 0 ? (
                      <p className="comm-mi-empty px-3 py-2 mb-0">
                        No one has read this message yet
                      </p>
                    ) : (
                      readMembers.map((m) => (
                        <div
                          key={`read-${m.userId}`}
                          className="comm-gi-member"
                        >
                          <img
                            src={m.avatarSrc}
                            alt=""
                            className="comm-gi-member-avatar"
                          />
                          <div className="comm-gi-member-body">
                            <p className="comm-gi-member-name mb-0 text-truncate">
                              {m.name}
                            </p>
                            <small className="comm-mi-when d-block">
                              {formatMessageInfoWhen(m.readAt)}
                            </small>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="comm-mi-section">
                    <div className="comm-mi-section-title">
                      <i className="ri-check-double-line text-muted me-1"></i>
                      Delivered to
                      <span className="comm-mi-count ms-1">
                        {deliveredMembers.length}
                      </span>
                    </div>
                    {deliveredMembers.length === 0 ? (
                      <p className="comm-mi-empty px-3 py-2 mb-0">
                        No pending deliveries
                      </p>
                    ) : (
                      deliveredMembers.map((m) => (
                        <div
                          key={`del-${m.userId}`}
                          className="comm-gi-member"
                        >
                          <img
                            src={m.avatarSrc}
                            alt=""
                            className="comm-gi-member-avatar"
                          />
                          <div className="comm-gi-member-body">
                            <p className="comm-gi-member-name mb-0 text-truncate">
                              {m.name}
                            </p>
                            <small className="comm-mi-when d-block">
                              {formatMessageInfoWhen(m.deliveredAt)}
                            </small>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="comm-mi-section">
                    <div className="comm-mi-section-title">
                      <i className="ri-time-line text-muted me-1"></i>
                      Remaining
                      <span className="comm-mi-count ms-1">
                        {remainingMembers.length}
                      </span>
                    </div>
                    {remainingMembers.length === 0 ? (
                      <p className="comm-mi-empty px-3 py-2 mb-0">
                        All members have received this message
                      </p>
                    ) : (
                      remainingMembers.map((m) => (
                        <div
                          key={`rem-${m.userId}`}
                          className="comm-gi-member"
                        >
                          <img
                            src={m.avatarSrc}
                            alt=""
                            className="comm-gi-member-avatar"
                          />
                          <div className="comm-gi-member-body">
                            <p className="comm-gi-member-name mb-0 text-truncate">
                              {m.name}
                            </p>
                            <small className="comm-mi-when d-block">
                              Not delivered yet
                            </small>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </SimpleBar>
          </>
        ) : null}
      </OffcanvasBody>
    </Offcanvas>
  );
};

export default MessageInfo;
