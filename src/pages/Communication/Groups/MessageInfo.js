import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Offcanvas, OffcanvasBody, Spinner } from "reactstrap";
import SimpleBar from "simplebar-react";
import classnames from "classnames";
import {
  getChatMessageInfo,
  resolveUserAvatarUrl,
  subscribeChatPresence,
} from "../../../helpers/softoncloud_auth_helper";

/** WhatsApp-style receipt time: "Today at 12:18 pm" */
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
  if (dayDiff === 0) return `Today at ${timePart}`;
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

const memberProfile = (mergedMembers, userId) => {
  const member = (mergedMembers || []).find(
    (m) => String(m.userId) === String(userId)
  );
  return {
    name: member?.isSelf ? "You" : member?.name || `User ${userId}`,
    avatarSrc: member?.avatarSrc || resolveUserAvatarUrl(userId, null),
  };
};

/**
 * Opens WhatsApp-style Message Info for the EXACT clicked message.
 */
export const useGroupMessageInfo = ({
  me,
  mergedMembers = [],
  onlineUserIds = null,
  onBeforeOpen = null,
  onError = null,
} = {}) => {
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [members, setMembers] = useState([]);
  const [onlineIds, setOnlineIds] = useState(() => {
    if (onlineUserIds instanceof Set) return new Set(onlineUserIds);
    if (Array.isArray(onlineUserIds)) {
      return new Set(onlineUserIds.map((id) => String(id)));
    }
    return new Set();
  });
  const messageRef = useRef(null);
  const requestSeqRef = useRef(0);
  // messageId → Map(userId → { deliveredAt, readAt }) — keep SignalR reads even if panel closed
  const receiptCacheRef = useRef(new Map());
  const mergedMembersRef = useRef(mergedMembers);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    mergedMembersRef.current = mergedMembers;
  }, [mergedMembers]);

  // Keep in sync when parent Groups presence updates.
  useEffect(() => {
    if (onlineUserIds instanceof Set) {
      setOnlineIds(new Set([...onlineUserIds].map(String)));
      return;
    }
    if (Array.isArray(onlineUserIds)) {
      setOnlineIds(new Set(onlineUserIds.map((id) => String(id))));
    }
  }, [onlineUserIds]);

  const rememberReceipt = useCallback((messageId, userId, patch) => {
    const mid = String(messageId ?? "");
    const uid = String(userId ?? "");
    if (!mid || !uid) return;
    if (!receiptCacheRef.current.has(mid)) {
      receiptCacheRef.current.set(mid, new Map());
    }
    const byUser = receiptCacheRef.current.get(mid);
    const prev = byUser.get(uid) || { deliveredAt: null, readAt: null };
    byUser.set(uid, {
      deliveredAt: patch.deliveredAt || prev.deliveredAt || null,
      readAt: patch.readAt || prev.readAt || null,
    });
  }, []);

  const applyReceiptToOpenMembers = useCallback(
    (messageId, userId, patch) => {
      const openMsg = messageRef.current;
      if (!openMsg?.id || String(openMsg.id) !== String(messageId)) return;
      const uid = String(userId);
      setMembers((prev) => {
        if (!prev.some((m) => String(m.userId) === uid)) {
          const profile = memberProfile(mergedMembersRef.current, uid);
          return [
            ...prev,
            {
              userId,
              name: profile.name,
              avatarSrc: profile.avatarSrc,
              deliveredAt: patch.deliveredAt || null,
              readAt: patch.readAt || null,
            },
          ];
        }
        return prev.map((m) =>
          String(m.userId) === uid
            ? {
                ...m,
                deliveredAt: patch.deliveredAt || m.deliveredAt || null,
                readAt: patch.readAt || m.readAt || null,
              }
            : m
        );
      });
    },
    []
  );

  const close = useCallback(() => {
    requestSeqRef.current += 1;
    setMessage(null);
    setMembers([]);
    setLoading(false);
    setLoadError("");
  }, []);

  const clearIfMessage = useCallback(
    (messageId) => {
      if (
        messageRef.current &&
        String(messageRef.current.id) === String(messageId)
      ) {
        close();
      }
    },
    [close]
  );

  const open = useCallback(
    async (msg) => {
      const messageId = msg?.id ?? msg?.messageId ?? msg?.MessageId;
      if (messageId == null || messageId === "") return;

      const requestSeq = ++requestSeqRef.current;
      const selected = {
        ...msg,
        id: messageId,
        chatId: msg?.chatId ?? msg?.raw?.chatId ?? msg?.raw?.ChatId ?? null,
      };
      // Open panel immediately (WhatsApp-style right popup).
      setMessage(selected);
      setLoading(true);
      setLoadError("");
      setMembers([]);
      if (typeof onBeforeOpen === "function") onBeforeOpen();

      const senderId = String(
        selected.senderUserId ??
          selected.raw?.senderUserId ??
          selected.raw?.SenderUserId ??
          (selected.from === "me" ? me?.userId : "") ??
          ""
      );

      const directory = (mergedMembers || [])
        .filter((m) => m && m.isActive !== false)
        .filter((m) => String(m.userId) !== senderId);

      const cached =
        receiptCacheRef.current.get(String(messageId)) || new Map();

      const buildRow = (userId, name, avatarSrc, apiRow) => {
        const cachedRow = cached.get(String(userId));
        return {
          userId,
          name,
          avatarSrc,
          deliveredAt:
            apiRow?.deliveredAt || cachedRow?.deliveredAt || null,
          readAt: apiRow?.readAt || cachedRow?.readAt || null,
        };
      };

      try {
        const info = await getChatMessageInfo(messageId);
        if (requestSeq !== requestSeqRef.current) return;

        // Keep API receipts in SignalR cache for later opens.
        (info?.members || []).forEach((row) => {
          if (!row?.userId) return;
          rememberReceipt(messageId, row.userId, {
            deliveredAt: row.deliveredAt,
            readAt: row.readAt,
          });
        });

        const receiptById = new Map(
          (info?.members || []).map((row) => [String(row.userId), row])
        );

        const byId = new Map();
        directory.forEach((m) => {
          const row = receiptById.get(String(m.userId));
          byId.set(
            String(m.userId),
            buildRow(
              m.userId,
              m.isSelf ? "You" : m.name || `User ${m.userId}`,
              m.avatarSrc || resolveUserAvatarUrl(m.userId, null),
              row
            )
          );
        });

        (info?.members || []).forEach((row) => {
          if (String(row.userId) === senderId) return;
          if (byId.has(String(row.userId))) return;
          const profile = memberProfile(mergedMembers, row.userId);
          byId.set(
            String(row.userId),
            buildRow(row.userId, profile.name, profile.avatarSrc, row)
          );
        });

        // Cached SignalR readers not yet in directory/API list.
        cached.forEach((row, uid) => {
          if (uid === senderId || byId.has(uid)) return;
          const profile = memberProfile(mergedMembers, uid);
          byId.set(uid, buildRow(uid, profile.name, profile.avatarSrc, row));
        });

        setMembers([...byId.values()]);
      } catch (error) {
        if (requestSeq !== requestSeqRef.current) return;
        // Still show group members; merge SignalR receipt cache (Read by).
        setMembers(
          directory.map((m) =>
            buildRow(
              m.userId,
              m.isSelf ? "You" : m.name || `User ${m.userId}`,
              m.avatarSrc || resolveUserAvatarUrl(m.userId, null),
              null
            )
          )
        );
        const errMsg = apiErrorMessage(error, "Unable to load message info.");
        setLoadError(errMsg);
        if (typeof onError === "function") onError(errMsg);
      } finally {
        if (requestSeq === requestSeqRef.current) setLoading(false);
      }
    },
    [mergedMembers, me?.userId, onBeforeOpen, onError, rememberReceipt]
  );

  useEffect(() => {
    const unsubscribe = subscribeChatPresence((event, payload) => {
      // Presence: online → Delivered to, offline → Remaining (when not read).
      if (event === "OnlineUsers") {
        const ids = Array.isArray(payload)
          ? payload.map((id) => String(id))
          : [];
        setOnlineIds(new Set(ids));
        return;
      }
      if (event === "UserOnline") {
        const id = String(payload ?? "");
        if (!id) return;
        setOnlineIds((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        return;
      }
      if (event === "UserOffline") {
        const id = String(payload ?? "");
        if (!id) return;
        setOnlineIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        return;
      }

      if (payload == null) return;

      if (event === "MessageDelivered") {
        const deliveredMessageId = String(
          payload.messageId ?? payload.MessageId ?? ""
        );
        const receiverId = String(
          payload.receiverUserId ?? payload.ReceiverUserId ?? ""
        );
        if (!deliveredMessageId || !receiverId) return;
        const when =
          payload.deliveredAt ??
          payload.DeliveredAt ??
          new Date().toISOString();
        rememberReceipt(deliveredMessageId, receiverId, {
          deliveredAt: when,
        });
        applyReceiptToOpenMembers(deliveredMessageId, receiverId, {
          deliveredAt: when,
        });
        return;
      }

      if (event === "MessagesRead") {
        const ids = Array.isArray(payload.messageIds)
          ? payload.messageIds.map(String)
          : Array.isArray(payload.MessageIds)
            ? payload.MessageIds.map(String)
            : [];
        const readerId = String(
          payload.readerUserId ?? payload.ReaderUserId ?? ""
        );
        if (!readerId) return;
        const when =
          payload.readAt ?? payload.ReadAt ?? new Date().toISOString();
        const payloadChatId = payload.chatId ?? payload.ChatId;
        const openMsg = messageRef.current;
        const openChatId =
          openMsg?.chatId ??
          openMsg?.raw?.chatId ??
          openMsg?.raw?.ChatId ??
          null;

        const targetMessageIds =
          ids.length > 0
            ? ids
            : openMsg?.id &&
              payloadChatId != null &&
              openChatId != null &&
              String(payloadChatId) === String(openChatId)
              ? [String(openMsg.id)]
              : [];

        // Cache every message id from the read event (panel may open later).
        if (ids.length > 0) {
          ids.forEach((mid) => {
            rememberReceipt(mid, readerId, {
              deliveredAt: when,
              readAt: when,
            });
            applyReceiptToOpenMembers(mid, readerId, {
              deliveredAt: when,
              readAt: when,
            });
          });
          return;
        }

        // Fallback: chat-scoped read with no messageIds list.
        targetMessageIds.forEach((mid) => {
          rememberReceipt(mid, readerId, {
            deliveredAt: when,
            readAt: when,
          });
          applyReceiptToOpenMembers(mid, readerId, {
            deliveredAt: when,
            readAt: when,
          });
        });
      }
    });
    return unsubscribe;
  }, [rememberReceipt, applyReceiptToOpenMembers]);

  return {
    message,
    members,
    onlineIds,
    loading,
    loadError,
    open,
    close,
    clearIfMessage,
    messageRef,
  };
};

/** WhatsApp row: avatar + name left, time right */
const MemberRow = ({ member, whenLabel }) => (
  <div className="comm-mi-member">
    <img src={member.avatarSrc} alt="" className="comm-mi-member-avatar" />
    <div className="comm-mi-member-body">
      <p className="comm-mi-member-name mb-0 text-truncate">{member.name}</p>
    </div>
    {whenLabel ? (
      <small className="comm-mi-when-right text-end">{whenLabel}</small>
    ) : null}
  </div>
);

const MessageInfo = ({
  message,
  members = [],
  onlineIds = null,
  loading = false,
  loadError = "",
  onClose,
}) => {
  const onlineSet = useMemo(() => {
    if (onlineIds instanceof Set) return onlineIds;
    if (Array.isArray(onlineIds)) return new Set(onlineIds.map(String));
    return new Set();
  }, [onlineIds]);

  // SignalR rules:
  // - readAt → Read by
  // - online (or deliveredAt) and not read → Delivered to
  // - offline and not delivered/read → Remaining
  const readMembers = useMemo(
    () => (members || []).filter((m) => m.readAt),
    [members]
  );
  const deliveredMembers = useMemo(
    () =>
      (members || []).filter((m) => {
        if (m.readAt) return false;
        if (m.deliveredAt) return true;
        return onlineSet.has(String(m.userId));
      }),
    [members, onlineSet]
  );
  const remainingMembers = useMemo(
    () =>
      (members || []).filter((m) => {
        if (m.readAt) return false;
        if (m.deliveredAt) return false;
        return !onlineSet.has(String(m.userId));
      }),
    [members, onlineSet]
  );
  const anyRead = readMembers.length > 0;
  const unreadRemaining = deliveredMembers.length + remainingMembers.length;

  return (
    <Offcanvas
      isOpen={Boolean(message)}
      direction="end"
      toggle={onClose}
      backdrop={false}
      scrollable
      className="offcanvas-end border-0 comm-group-info comm-msg-info"
      style={{ zIndex: 1100 }}
      tabIndex="-1"
    >
      <OffcanvasBody className="p-0 d-flex flex-column h-100">
        <div className="comm-mi-header">
          <button
            type="button"
            className="btn btn-ghost-secondary btn-icon btn-sm"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="ri-close-line fs-18"></i>
          </button>
          <h5 className="comm-mi-title mb-0 flex-grow-1">Message info</h5>
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
                        "comm-mi-ticks-read": anyRead,
                        "comm-mi-ticks-delivered": !anyRead,
                      })}
                    ></i>
                  ) : null}
                </div>
              </div>
            </div>

            <SimpleBar className="comm-mi-scroll flex-grow-1">
              {loading ? (
                <div className="text-center py-5 text-muted">
                  <Spinner size="sm" className="me-2" />
                  Loading...
                </div>
              ) : (
                <>
                  {loadError ? (
                    <div className="text-center text-muted px-3 pt-3 pb-2 fs-12">
                      {loadError}
                    </div>
                  ) : null}
                  <div className="comm-mi-section">
                    <div className="comm-mi-section-title">
                      <i className="ri-check-double-line comm-mi-ticks-read me-2"></i>
                      Read by
                    </div>
                    {readMembers.length === 0 ? (
                      <p className="comm-mi-empty px-3 pb-3 mb-0">
                        No one has read this message yet.
                      </p>
                    ) : (
                      <>
                        {readMembers.map((m) => (
                          <MemberRow
                            key={`read-${m.userId}`}
                            member={m}
                            whenLabel={formatMessageInfoWhen(m.readAt)}
                          />
                        ))}
                        {unreadRemaining > 0 ? (
                          <p className="comm-mi-remaining px-3 py-2 mb-0">
                            {unreadRemaining} remaining
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="comm-mi-section">
                    <div className="comm-mi-section-title">
                      <i className="ri-check-double-line comm-mi-ticks-delivered me-2"></i>
                      Delivered to
                    </div>
                    {deliveredMembers.length === 0 ? (
                      <p className="comm-mi-empty px-3 pb-3 mb-0">
                        {remainingMembers.length > 0
                          ? "Not delivered to anyone yet."
                          : "Everyone who received it has read it."}
                      </p>
                    ) : (
                      <>
                        {deliveredMembers.map((m) => (
                          <MemberRow
                            key={`del-${m.userId}`}
                            member={m}
                            whenLabel={
                              formatMessageInfoWhen(m.deliveredAt) || "Online"
                            }
                          />
                        ))}
                        {remainingMembers.length > 0 ? (
                          <p className="comm-mi-remaining px-3 py-2 mb-0">
                            {remainingMembers.length} remaining
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>

                  {remainingMembers.length > 0 ? (
                    <div className="comm-mi-section">
                      <div className="comm-mi-section-title">
                        <i className="ri-time-line text-muted me-2"></i>
                        Remaining
                      </div>
                      {remainingMembers.map((m) => (
                        <MemberRow
                          key={`rem-${m.userId}`}
                          member={m}
                          whenLabel="Offline"
                        />
                      ))}
                    </div>
                  ) : null}
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
