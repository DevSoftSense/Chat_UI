/**
 * All User Communication — Groups tab (Chats-style list + inline group messages).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SimpleBar from "simplebar-react";
import { Modal, ModalBody, ModalHeader, Spinner, TabPane } from "reactstrap";
import { getCommAvatarSrc } from "../components/CommAvatar";
import {
  IMAGE_EXTS,
  VIDEO_EXTS,
  cleanAttachmentDisplayName,
  fileExt,
  resolveAttachMeta,
} from "../Messages/MessageAttachments";
import {
  getGroupChatMessagesForObserver,
  getOrganisationChatGroupsForObserver,
  getOrganisationGroupMembersForObserver,
  resolveChatAttachmentUrl,
  resolveUserAvatarUrl,
} from "../../../helpers/softoncloud_auth_helper";

export const formatGroupMsgTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const GROUP_AVATAR_COLORS = [
  "#4b38b3",
  "#3577f1",
  "#0ab39c",
  "#f7b84b",
  "#f06548",
  "#299cdb",
  "#405189",
];

const initialsFromName = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "G";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const colorForGroupId = (groupId) => {
  const n = Math.abs(Number(groupId) || 0);
  return GROUP_AVATAR_COLORS[n % GROUP_AVATAR_COLORS.length];
};

/** Same idea as Groups page — chat attachment path, not user profile store. */
const pickAucGroupAvatarRaw = (g) =>
  g?.profilePic ||
  g?.ProfilePic ||
  g?.profile_pic ||
  g?.groupProfilePic ||
  g?.GroupProfilePic ||
  g?.avatarUrl ||
  g?.AvatarUrl ||
  null;

const resolveAucGroupAvatarSrc = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (
    /^https?:\/\//i.test(value) ||
    /^data:/i.test(value) ||
    value.startsWith("blob:")
  ) {
    return value;
  }
  return resolveChatAttachmentUrl(value) || value;
};

/** Avatar cell: real group DP, else coloured initials (not random user photo). */
export const AucGroupAvatar = ({ group, size = 32 }) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [group?.groupId, group?.avatarSrc]);
  if (!group) return null;
  const showImg = Boolean(group.avatarSrc) && !broken;
  if (showImg) {
    return (
      <img
        src={group.avatarSrc}
        alt=""
        className="rounded-circle flex-shrink-0"
        style={{ width: size, height: size, objectFit: "cover" }}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      className="rounded-circle text-white d-inline-flex align-items-center justify-content-center fw-semibold flex-shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size <= 32 ? "0.7rem" : "0.85rem",
        backgroundColor: group.color || colorForGroupId(group.groupId),
      }}
    >
      {group.initials || "G"}
    </span>
  );
};

/** Map API group row for sidebar list. */
export const mapAucGroupRow = (g) => {
  const groupId = Number(g?.groupId ?? g?.GroupId ?? 0);
  if (!Number.isFinite(groupId) || groupId <= 0) return null;
  const name = g?.groupName || g?.GroupName || "Group";
  const avatarRaw = pickAucGroupAvatarRaw(g);
  const previewRaw = g?.lastMessage ?? g?.LastMessage ?? g?.preview ?? "";
  const previewTime =
    g?.lastMessageAt ?? g?.LastMessageAt ?? g?.updatedAt ?? g?.UpdatedAt ?? null;
  const createdBy = Number(g?.createdBy ?? g?.CreatedBy ?? 0) || null;
  const createdAt =
    g?.createdAt ?? g?.CreatedAt ?? g?.created_on ?? null;
  return {
    id: String(groupId),
    groupId,
    chatId: Number(g?.chatId ?? g?.ChatId ?? 0) || null,
    name,
    members: Number(g?.memberCount ?? g?.MemberCount ?? g?.members ?? 0) || null,
    createdBy,
    createdAt,
    initials: initialsFromName(name),
    color: colorForGroupId(groupId),
    avatarRaw: avatarRaw || null,
    avatarSrc: resolveAucGroupAvatarSrc(avatarRaw),
    preview: String(previewRaw || "").trim(),
    time: previewTime ? formatGroupMsgTime(previewTime) : "",
  };
};

export const filterGroupsBySearch = (groups, search) => {
  const q = String(search || "").trim().toLowerCase();
  if (!q) return groups || [];
  return (groups || []).filter((g) =>
    String(g.name || "").toLowerCase().includes(q)
  );
};

/** Load + filter groups for the Groups tab. */
export const useAucGroups = (allowed, search) => {
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState("");

  const refreshGroups = useCallback(async ({ silent = false } = {}) => {
    if (!allowed) {
      setGroups([]);
      return [];
    }
    if (!silent) {
      setGroupsLoading(true);
      setGroupsError("");
    }
    try {
      const rows = await getOrganisationChatGroupsForObserver();
      const mapped = (rows || []).map(mapAucGroupRow).filter(Boolean);
      setGroups(mapped);
      return mapped;
    } catch (err) {
      if (!silent) {
        setGroupsError(err?.message || "Failed to load groups.");
        setGroups([]);
      }
      return [];
    } finally {
      if (!silent) setGroupsLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    if (!allowed) {
      setGroups([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      await refreshGroups({ silent: false });
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, refreshGroups]);

  const filteredGroups = useMemo(
    () => filterGroupsBySearch(groups, search),
    [groups, search]
  );

  return {
    groups,
    groupsLoading,
    groupsError,
    filteredGroups,
    setGroups,
    refreshGroups,
  };
};

/** Map group chat API message → UI row (WhatsApp-style, sender shown). */
export const mapGroupMessageRow = (
  msg,
  userNameById = new Map(),
  userTypeById = new Map(),
  userAvatarById = new Map(),
  myUserId = 0
) => {
  const senderId = Number(msg?.senderUserId ?? msg?.SenderUserId ?? 0);
  const sentAt =
    msg?.sentAt ??
    msg?.SentAt ??
    msg?.createdAt ??
    msg?.CreatedAt ??
    null;
  const readAt = msg?.readAt ?? msg?.ReadAt ?? null;
  const deletedAt = msg?.deletedAt ?? msg?.DeletedAt ?? null;
  const deletedBy = Number(msg?.deletedBy ?? msg?.DeletedBy ?? 0) || null;
  const body = String(msg?.messageBody ?? msg?.MessageBody ?? "").trim();
  const path1 = msg?.attachmentPath1 ?? msg?.AttachmentPath1 ?? null;
  const attach = resolveAttachMeta(body, msg?.typeName ?? msg?.TypeName);
  const fileNameFromPath = path1 ? String(path1).split("/").pop() : null;
  const fileName = cleanAttachmentDisplayName(
    attach?.fileName || fileNameFromPath || ""
  );
  const isFile = Boolean(attach || path1);
  let mediaSubtype = attach?.mediaSubtype || null;
  const ext = fileExt(fileName || fileNameFromPath);
  if (!mediaSubtype && IMAGE_EXTS.has(ext)) mediaSubtype = "photo";
  if (!mediaSubtype && VIDEO_EXTS.has(ext)) mediaSubtype = "video";

  const text = isFile
    ? attach?.caption || (!mediaSubtype ? fileName || body : "") || ""
    : body;

  const senderName =
    userNameById.get(String(senderId)) || `User ${senderId || "?"}`;
  const senderType = userTypeById.get(String(senderId)) || null;
  const senderAvatarSrc = getCommAvatarSrc(
    senderId,
    userAvatarById.get(String(senderId)) || null
  );

  const isSelf =
    myUserId > 0 && String(senderId) === String(myUserId);

  return {
    id: String(msg?.messageId ?? msg?.MessageId ?? `${senderId}-${sentAt}`),
    senderId,
    senderName,
    senderType,
    senderAvatarSrc,
    text,
    time: formatGroupMsgTime(sentAt),
    sentAt,
    status: readAt ? "Seen" : "Delivered",
    side: isSelf ? "from" : "to",
    type: isFile ? "file" : "text",
    attachKind: attach?.attachKind || (path1 ? "document" : null),
    mediaSubtype,
    fileName: fileName || null,
    caption: attach?.caption || null,
    attachmentPath1: path1,
    readAt,
    deletedAt,
    deletedBy,
    deletedByName: deletedBy
      ? userNameById.get(String(deletedBy)) || `User ${deletedBy}`
      : null,
    receiverName: "Group",
    receiverType: null,
  };
};

/** Fetch messages for a group chat (same API as Groups page). */
export const fetchGroupMessages = async (chatId) => {
  const parsed = Number(chatId);
  if (!Number.isFinite(parsed) || parsed <= 0) return [];
  const rows = await getGroupChatMessagesForObserver(parsed);
  return Array.isArray(rows) ? rows : [];
};

/** Load group messages with user maps for sender labels. */
export const loadGroupMessageRows = async (
  chatId,
  userNameById,
  userTypeById,
  userAvatarById,
  myUserId
) => {
  const rows = await fetchGroupMessages(chatId);
  return rows
    .map((m) =>
      mapGroupMessageRow(
        m,
        userNameById,
        userTypeById,
        userAvatarById,
        myUserId
      )
    )
    .filter((m) => m.text || m.attachmentPath1 || m.type === "file");
};

/** Groups sidebar tab — same layout as Chats / Direct Messages. */
export const AucGroupsSidebarTab = ({
  groupsLoading,
  groupsError,
  filteredGroups,
  activeGroupId,
  onPickGroup,
}) => (
  <TabPane tabId="2" id="auc-groups">
    <SimpleBar
      className="chat-room-list pt-3"
      style={{ margin: "-16px 0px 0px" }}
    >
      <div className="d-flex align-items-center px-4 mb-2">
        <div className="flex-grow-1">
          <h4 className="mb-0 fs-11 text-muted text-uppercase">Groups</h4>
        </div>
      </div>
      <div className="chat-message-list">
        {groupsLoading && (
          <div className="text-center text-muted py-4 fs-13 px-3">
            Loading groups...
          </div>
        )}
        {!groupsLoading && groupsError && (
          <div className="text-center text-danger py-4 px-3 fs-13">
            {groupsError}
          </div>
        )}
        {!groupsLoading && !groupsError && !filteredGroups.length && (
          <div className="text-center text-muted py-4 px-3 fs-13">
            No groups found
          </div>
        )}
        <ul className="list-unstyled chat-list chat-user-list users-list">
          {!groupsLoading &&
            !groupsError &&
            filteredGroups.map((group) => (
              <li
                key={group.id}
                className={
                  String(activeGroupId) === String(group.groupId)
                    ? "active"
                    : ""
                }
              >
                <Link
                  to="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onPickGroup(group);
                  }}
                >
                  <div className="d-flex align-items-center">
                    <div className="flex-shrink-0 chat-user-img align-self-center me-2 ms-0">
                      <div className="avatar-xs d-flex align-items-center justify-content-center">
                        <AucGroupAvatar group={group} size={32} />
                      </div>
                    </div>
                    <div className="flex-grow-1 overflow-hidden">
                      <p className="text-truncate mb-0">{group.name}</p>
                      <p className="text-truncate mb-0 fs-12 text-muted">
                        {group.preview ||
                          (group.members != null && group.members > 0
                            ? `${group.members} members`
                            : "Group")}
                      </p>
                    </div>
                    {group.time ? (
                      <small className="text-muted flex-shrink-0">
                        {group.time}
                      </small>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
        </ul>
      </div>
    </SimpleBar>
  </TabPane>
);

/** Group chat top bar (replaces To/From when a group is selected). */
export const AucGroupChatTopbar = ({ group, onOpenInfo }) => {
  if (!group) return null;
  const memberLabel =
    group.members != null && group.members > 0
      ? `${group.members} members`
      : "Group chat";
  return (
    <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap w-100">
      <div className="d-flex align-items-center gap-2 min-w-0">
        <AucGroupAvatar group={group} size={32} />
        <div className="min-w-0">
          <p className="mb-0 fw-medium fs-14 text-truncate">{group.name}</p>
          <button
            type="button"
            className="btn btn-link p-0 text-muted fs-12 text-decoration-none"
            onClick={onOpenInfo}
          >
            {memberLabel} · Group info
          </button>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-soft-primary btn-sm"
        onClick={onOpenInfo}
        title="Group info"
      >
        <i className="ri-information-line" />
      </button>
    </div>
  );
};

/** Merge SoftOnCloud users into observer member rows. */
export const mapAucGroupMembers = (rows, users = []) => {
  const byId = new Map((users || []).map((u) => [String(u.id), u]));
  return (rows || [])
    .map((m) => {
      const userId = Number(m?.userId ?? m?.UserId ?? 0);
      if (!Number.isFinite(userId) || userId <= 0) return null;
      const u = byId.get(String(userId));
      const name =
        u?.realName || u?.name || `User ${userId}`;
      const userType = u?.userType || null;
      return {
        userId,
        isAdmin: Boolean(m?.isAdmin ?? m?.IsAdmin),
        name,
        userType,
        avatarSrc:
          u?.avatarSrc ||
          getCommAvatarSrc(userId, resolveUserAvatarUrl(userId, null)),
      };
    })
    .filter(Boolean);
};

/** Read-only Group Info modal — member list for All User Communication. */
export const AucGroupInfoModal = ({
  isOpen,
  onClose,
  group,
  users,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!isOpen || !group?.groupId) {
      setMembers([]);
      setError("");
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const rows = await getOrganisationGroupMembersForObserver(group.groupId);
        if (cancelled) return;
        setMembers(mapAucGroupMembers(rows, users));
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load group members.");
          setMembers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, group?.groupId, users]);

  const creator = useMemo(() => {
    const creatorId = Number(group?.createdBy || 0);
    if (!Number.isFinite(creatorId) || creatorId <= 0) return null;
    const fromMembers = members.find((m) => String(m.userId) === String(creatorId));
    if (fromMembers) return fromMembers;
    const u = (users || []).find((x) => String(x.id) === String(creatorId));
    return {
      userId: creatorId,
      name: u?.realName || u?.name || `User ${creatorId}`,
      userType: u?.userType || null,
      avatarSrc:
        u?.avatarSrc ||
        getCommAvatarSrc(creatorId, resolveUserAvatarUrl(creatorId, null)),
      isAdmin: true,
    };
  }, [group?.createdBy, members, users]);

  const createdWhen = useMemo(() => {
    if (!group?.createdAt) return "";
    const d = new Date(group.createdAt);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [group?.createdAt]);

  return (
    <Modal isOpen={isOpen} toggle={onClose} centered>
      <ModalHeader toggle={onClose}>
        {group?.name ? `${group.name} · Group info` : "Group info"}
      </ModalHeader>
      <ModalBody>
        {loading ? (
          <div className="text-center py-4 text-muted">
            <Spinner size="sm" className="me-2" />
            Loading members...
          </div>
        ) : error ? (
          <div className="text-center text-danger py-3 fs-13">{error}</div>
        ) : (
          <>
            {creator ? (
              <div className="mb-3 pb-3 border-bottom">
                <p className="text-muted fs-11 text-uppercase mb-2">Created by</p>
                <div className="d-flex align-items-center gap-2">
                  <img
                    src={creator.avatarSrc}
                    alt=""
                    className="rounded-circle flex-shrink-0"
                    style={{ width: 40, height: 40, objectFit: "cover" }}
                  />
                  <div className="min-w-0">
                    <p className="mb-0 fw-medium fs-13 text-truncate">
                      {creator.name}
                    </p>
                    <p className="mb-0 text-muted fs-11">
                      {createdWhen
                        ? `Created on ${createdWhen}`
                        : "Group creator"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {!members.length ? (
              <div className="text-center text-muted py-3 fs-13">No members</div>
            ) : (
              <>
                <p className="text-muted fs-12 mb-3">
                  {members.length} member{members.length === 1 ? "" : "s"}
                </p>
                <SimpleBar style={{ maxHeight: 360 }}>
                  <ul className="list-unstyled mb-0">
                    {members.map((m) => (
                      <li
                        key={m.userId}
                        className="d-flex align-items-center gap-2 py-2 border-bottom"
                      >
                        <img
                          src={m.avatarSrc}
                          alt=""
                          className="rounded-circle flex-shrink-0"
                          style={{ width: 36, height: 36, objectFit: "cover" }}
                        />
                        <div className="min-w-0 flex-grow-1">
                          <p className="mb-0 fw-medium fs-13 text-truncate">
                            {m.name}
                          </p>
                          {m.isAdmin ? (
                            <span className="badge bg-soft-primary text-primary fs-10">
                              Admin
                            </span>
                          ) : (
                            <span className="text-muted fs-11">Member</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </SimpleBar>
              </>
            )}
          </>
        )}
      </ModalBody>
    </Modal>
  );
};

/** Hook: load + live-update group thread for selected group. */
export const useAucGroupThread = ({
  activeGroup,
  allowed,
  users,
  myUserId,
  scrollToBottom,
}) => {
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState("");
  const loadSeqRef = React.useRef(0);

  const buildMaps = useCallback(() => {
    const nameMap = new Map(
      (users || []).map((u) => [String(u.id), u.realName || u.name])
    );
    const typeMap = new Map(
      (users || [])
        .filter((u) => u.userType)
        .map((u) => [String(u.id), u.userType])
    );
    const avatarMap = new Map(
      (users || []).map((u) => [String(u.id), u.avatarSrc || null])
    );
    return { nameMap, typeMap, avatarMap };
  }, [users]);

  const loadGroupConversation = useCallback(
    async (group, { silent = false } = {}) => {
      const chatId = Number(group?.chatId);
      if (!Number.isFinite(chatId) || chatId <= 0) {
        setGroupMessages([]);
        setGroupError("Group chat id missing.");
        return [];
      }

      const seq = ++loadSeqRef.current;
      if (!silent) {
        setGroupLoading(true);
        setGroupError("");
      }

      try {
        const { nameMap, typeMap, avatarMap } = buildMaps();
        const mapped = await loadGroupMessageRows(
          chatId,
          nameMap,
          typeMap,
          avatarMap,
          myUserId
        );
        if (seq !== loadSeqRef.current) return [];
        let shouldScroll = !silent;
        setGroupMessages((prev) => {
          const prevLast = prev[prev.length - 1]?.id;
          const nextLast = mapped[mapped.length - 1]?.id;
          if (
            silent &&
            (mapped.length > prev.length ||
              String(prevLast || "") !== String(nextLast || ""))
          ) {
            shouldScroll = true;
          }
          return mapped;
        });
        if (shouldScroll) setTimeout(scrollToBottom, 50);
        return mapped;
      } catch (err) {
        if (seq === loadSeqRef.current && !silent) {
          setGroupError(err?.message || "Failed to load group messages.");
          setGroupMessages([]);
        }
        return [];
      } finally {
        if (seq === loadSeqRef.current && !silent) setGroupLoading(false);
      }
    },
    [buildMaps, myUserId, scrollToBottom]
  );

  useEffect(() => {
    if (!allowed || !activeGroup?.chatId) {
      setGroupMessages([]);
      setGroupError("");
      return undefined;
    }
    loadGroupConversation(activeGroup);
    return () => {
      loadSeqRef.current += 1;
    };
  }, [allowed, activeGroup?.groupId, activeGroup?.chatId, loadGroupConversation]);

  const appendGroupMessage = useCallback(
    (payload, usersRef) => {
      const gid = payload?.groupId ?? payload?.GroupId;
      if (gid == null || gid === "") return;
      if (
        !activeGroup ||
        String(activeGroup.groupId) !== String(gid)
      ) {
        return;
      }

      const list = usersRef?.current || users || [];
      const nameMap = new Map(
        list.map((u) => [String(u.id), u.realName || u.name])
      );
      const typeMap = new Map(
        list.filter((u) => u.userType).map((u) => [String(u.id), u.userType])
      );
      const avatarMap = new Map(
        list.map((u) => [String(u.id), u.avatarSrc || null])
      );
      const uiMsg = mapGroupMessageRow(
        payload,
        nameMap,
        typeMap,
        avatarMap,
        myUserId
      );
      if (!uiMsg.text && !uiMsg.attachmentPath1) return;

      setGroupMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(uiMsg.id))) return prev;
        return [...prev, uiMsg];
      });
      setTimeout(scrollToBottom, 50);
    },
    [activeGroup, myUserId, scrollToBottom, users]
  );

  const markGroupMessageDeleted = useCallback((messageId, payload, usersRef) => {
    const deletedAt =
      payload?.deletedAt ?? payload?.DeletedAt ?? new Date().toISOString();
    const deletedBy = Number(payload?.deletedBy ?? payload?.DeletedBy ?? 0) || null;
    const list = usersRef?.current || users || [];
    const deletedByName = deletedBy
      ? list.find((u) => String(u.id) === String(deletedBy))?.realName ||
        list.find((u) => String(u.id) === String(deletedBy))?.name ||
        `User ${deletedBy}`
      : null;

    setGroupMessages((prev) =>
      prev.map((m) =>
        String(m.id) === String(messageId)
          ? {
              ...m,
              deletedAt,
              deletedBy,
              deletedByName,
              text: m.text || "This message was deleted",
            }
          : m
      )
    );
  }, [users]);

  return {
    groupMessages,
    groupLoading,
    groupError,
    loadGroupConversation,
    appendGroupMessage,
    markGroupMessageDeleted,
  };
};
