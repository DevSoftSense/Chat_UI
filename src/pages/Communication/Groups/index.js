import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Col,
  Container,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Nav,
  NavItem,
  NavLink,
  Offcanvas,
  OffcanvasBody,
  Row,
  Spinner,
  TabContent,
  TabPane,
  UncontrolledDropdown,
  UncontrolledTooltip,
} from "reactstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";
import SimpleBar from "simplebar-react";
import classnames from "classnames";
import FeatherIcon from "feather-icons-react";
import Picker from "emoji-picker-react";
import { getCommAvatarSrc } from "../components/CommAvatar";
import {
  clearComposerDraft,
  getComposerDraft,
  groupDraftKey,
  setComposerDraft,
} from "../Messages/MessageAttachments";
import MessageInfo, { useGroupMessageInfo } from "./MessageInfo";
import { MessageReactionDetails } from "../Messages/MessageActions";
import {
  attachMenuItems,
  classifyAttachment,
  attachmentIconForFileName,
  attachKindToMessageTypeId,
  formatGroupAttachMessageBody,
  pickUploadedAttachmentPath,
} from "./GroupAttachments";
import {
  addGroupMembers,
  createGroup,
  getGroupDetails,
  getGroups,
  joinGroupHub,
  leaveGroup,
  leaveGroupHub,
  removeGroupMember,
  setGroupMemberAdmin,
  updateGroup,
} from "../../../helpers/groupsApi";
import {
  getChatMessages,
  getConfiguredProductId,
  getOrganisationProductUsers,
  getOrCreatePrivateChat,
  getSessionPublicOrgId,
  getSessionUserIdentity,
  resolveChatAttachmentUrl,
  resolveUserAvatarUrl,
  sendChatMessage,
  subscribeChatPresence,
  sendGroupChatTyping,
  uploadChatAttachments,
  fetchChatAttachmentBlob,
  toggleChatMessageReaction,
  deleteChatMessage,
  forwardChatMessage,
  toggleChatMessageStar,
  markChatMessagesRead,
  ackChatMessageDelivered,
  setGroupsUnreadTotal,
  sumGroupListUnread,
  DEFAULT_CHAT_MAX_FILE_SIZE_MB,
  getChatDateFormat,
  formatDateByPreference,
} from "../../../helpers/softoncloud_auth_helper";
import "../Messages/messages.scss";

const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"']+/gi;

/** Same pattern as One-to-One Messages — hide soft-deleted-for-me in this browser only. */
const DELETED_FOR_ME_KEY = "chatDeletedForMe";
const DOWNLOADED_ATTACHMENTS_KEY = "chatDownloadedAttachments";
const deletedForMeStorageKey = (userId) =>
  `${DELETED_FOR_ME_KEY}:${String(userId || "anon")}`;

const readDeletedForMeIds = (userId) => {
  try {
    const raw = JSON.parse(
      localStorage.getItem(deletedForMeStorageKey(userId)) || "[]"
    );
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
};

const writeDeletedForMeIds = (userId, keys) => {
  try {
    localStorage.setItem(
      deletedForMeStorageKey(userId),
      JSON.stringify(Array.from(keys).map(String))
    );
  } catch {
    /* ignore quota / private mode */
  }
};

const readDownloadedAttachments = () => {
  try {
    const raw = JSON.parse(
      localStorage.getItem(DOWNLOADED_ATTACHMENTS_KEY) || "[]"
    );
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
};

const writeDownloadedAttachments = (keys) => {
  try {
    localStorage.setItem(
      DOWNLOADED_ATTACHMENTS_KEY,
      JSON.stringify(Array.from(keys).map(String))
    );
  } catch {
    /* ignore */
  }
};

const getAttachmentStorageKey = (msg) => {
  const path =
    msg?.attachmentPath1 ||
    msg?.raw?.attachmentPath1 ||
    msg?.raw?.AttachmentPath1 ||
    msg?.raw?.attachment_path_1 ||
    null;
  if (path) return String(path);
  if (msg?.id) return `msg:${msg.id}`;
  return null;
};

const buildReplyPreview = (msg) => {
  if (!msg) return null;
  const text =
    msg.fileName ||
    msg.text ||
    (msg.attachmentPath1
      ? String(msg.attachmentPath1).split("/").pop()
      : "") ||
    "";
  return {
    id: msg.id != null ? String(msg.id) : null,
    name: msg.from === "me" ? "You" : msg.sender || "Member",
    text: String(text).trim(),
    from: msg.from || null,
  };
};

const attachReplyPreviews = (list) => {
  if (!Array.isArray(list) || !list.length) return list || [];
  const byId = new Map(list.map((m) => [String(m.id), m]));
  return list.map((msg) => {
    const parentId =
      msg?.parentMessageId ||
      (msg?.replyTo?.id != null ? Number(msg.replyTo.id) : null);
    const parent = parentId ? byId.get(String(parentId)) : null;
    if (parent) {
      const preview = buildReplyPreview(parent);
      return {
        ...msg,
        parentMessageId: parentId || msg.parentMessageId || null,
        replyTo: {
          ...preview,
          text: msg.replyTo?.text || preview.text,
          name: msg.replyTo?.name || preview.name,
          id: String(parent.id),
        },
      };
    }
    return msg;
  });
};

const messageActionItems = [
  { id: "info", label: "Message info", icon: "ri-information-line" },
  { id: "reply", label: "Reply", icon: "ri-reply-line" },
  { id: "copy", label: "Copy", icon: "ri-file-copy-line" },
  { id: "download", label: "Download", icon: "ri-download-2-line" },
  { id: "forward", label: "Forward", icon: "ri-share-forward-line" },
  { id: "star", label: "Star", icon: "ri-star-line" },
  { id: "more", label: "More", icon: "ri-more-fill" },
  { id: "divider-delete", type: "divider" },
  { id: "delete", label: "Delete", icon: "ri-delete-bin-line", danger: true },
];

const QUICK_REACTIONS = [
  { code: "LIKE", emoji: "👍" },
  { code: "LOVE", emoji: "❤️" },
  { code: "LAUGH", emoji: "😂" },
  { code: "WOW", emoji: "😮" },
  { code: "SAD", emoji: "😢" },
  { code: "THANKS", emoji: "🙏" },
];

const REACTION_CODE_SET = new Set(QUICK_REACTIONS.map((r) => r.code));

const reactionCodeToEmoji = (code) => {
  if (!code) return null;
  const found = QUICK_REACTIONS.find(
    (r) => r.code === String(code).trim().toUpperCase()
  );
  return found?.emoji || null;
};

const normalizeEmojiKey = (emoji) =>
  String(emoji || "")
    .replace(/\uFE0F/g, "")
    .trim();

const emojiToReactionCode = (emoji) => {
  if (!emoji) return null;
  const key = normalizeEmojiKey(emoji);
  const found = QUICK_REACTIONS.find(
    (r) => normalizeEmojiKey(r.emoji) === key
  );
  return found?.code || null;
};

const normalizeReactionCode = (value) => {
  if (value == null || String(value).trim() === "") return null;
  const upper = String(value).trim().toUpperCase();
  if (REACTION_CODE_SET.has(upper)) return upper;
  return emojiToReactionCode(value);
};

const joinReactionEmojis = (...emojis) => {
  const seen = new Set();
  const parts = [];
  emojis.forEach((emoji) => {
    const key = normalizeEmojiKey(emoji);
    if (!key || seen.has(key)) return;
    seen.add(key);
    parts.push(String(emoji).trim());
  });
  return parts.length ? parts.join("") : null;
};

const patchMessageReactions = (msg, patch = {}) => {
  const reactionCode =
    patch.reactionCode !== undefined ? patch.reactionCode : msg.reactionCode;
  const myEmoji =
    patch.myEmoji !== undefined
      ? patch.myEmoji
      : reactionCode
        ? reactionCodeToEmoji(reactionCode)
        : null;
  const peerReactionCode =
    patch.peerReactionCode !== undefined
      ? patch.peerReactionCode
      : msg.peerReactionCode;
  const peerReaction =
    patch.peerReaction !== undefined
      ? patch.peerReaction
      : peerReactionCode
        ? reactionCodeToEmoji(peerReactionCode)
        : msg.peerReaction || null;
  return {
    ...msg,
    reactionCode: reactionCode || null,
    peerReactionCode: peerReactionCode || null,
    peerReaction: peerReaction || null,
    reaction: joinReactionEmojis(myEmoji, peerReaction),
  };
};

const GROUP_COLORS = ["#2563eb", "#8b5cf6", "#10b981", "#f59e0b", "#0ea5e9", "#ec4899"];

const formatMsgTime = (value) => {
  if (!value) {
    try {
      return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(value);
  }
};

const MSG_STATUS = {
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
};

const resolveGroupOutgoingStatus = (msg) => {
  if (!msg || msg.from !== "me") return null;
  if (msg.status === MSG_STATUS.READ || msg.read || msg.readAt) return MSG_STATUS.READ;
  if (msg.status === MSG_STATUS.DELIVERED) return MSG_STATUS.DELIVERED;
  return MSG_STATUS.SENT;
};

/** WhatsApp-style day label — uses Settings date format */
const formatGroupChatDayLabel = (value, dateFormat = getChatDateFormat()) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const today = startOfDay(new Date());
  const msgDay = startOfDay(date);
  const diffDays = Math.round((today - msgDay) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return formatDateByPreference(date, dateFormat);
};

const getGroupMessageDayKey = (msg) => {
  const raw = msg?.sentAt || msg?.raw?.sentAt || msg?.raw?.SentAt || msg?.raw?.createdAt;
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const withGroupDateSeparators = (list, dateFormat = getChatDateFormat()) => {
  const rows = [];
  let lastKey = "";
  (list || []).forEach((msg) => {
    const key = getGroupMessageDayKey(msg);
    if (key && key !== lastKey) {
      rows.push({
        id: `day-${key}`,
        isDateSeparator: true,
        label: formatGroupChatDayLabel(msg.sentAt, dateFormat),
      });
      lastKey = key;
    }
    rows.push(msg);
  });
  return rows;
};

const initialsFromName = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "G";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const colorForId = (id) => {
  const n = Math.abs(Number(id) || 0);
  return GROUP_COLORS[n % GROUP_COLORS.length];
};

const makeGroupCode = (groupName) => {
  const base = String(groupName || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);
  const suffix = String(Date.now()).slice(-4);
  return `${base || "GRP"}${suffix}`.slice(0, 50);
};

const pickUserName = (user) =>
  user?.displayName ||
  user?.DisplayName ||
  [user?.firstName || user?.FirstName, user?.lastName || user?.LastName]
    .filter(Boolean)
    .join(" ") ||
  user?.email ||
  user?.Email ||
  `User ${user?.userId || user?.UserId || ""}`;

const pickUserAvatar = (user) =>
  user?.profileImageUrl ||
  user?.ProfileImageUrl ||
  user?.avatarUrl ||
  user?.AvatarUrl ||
  user?.profileImage ||
  user?.ProfileImage ||
  null;

const mapSoftOnCloudUser = (user, me = null) => {
  const userId = Number(user?.userId ?? user?.UserId);
  const name = pickUserName(user);
  const email = user?.email || user?.Email || "";
  const phone = user?.phone || user?.Phone || user?.phoneNumber || "";
  const avatarSrc = resolveUserAvatarUrl(userId, pickUserAvatar(user));
  const isSelf = me?.userId && String(me.userId) === String(userId);
  const status =
    user?.presenceStatus ||
    user?.PresenceStatus ||
    user?.userStatus ||
    user?.UserStatus ||
    user?.status ||
    user?.Status ||
    null;
  return {
    userId,
    name: isSelf ? "You" : name,
    realName: name,
    email,
    phone,
    avatarSrc: avatarSrc || getCommAvatarSrc(userId),
    isSelf: Boolean(isSelf),
    status: status ? String(status).trim().toLowerCase() : null,
  };
};

const mapGroupListItem = (g) => {
  const groupId = Number(g.groupId ?? g.GroupId);
  const name = g.groupName || g.GroupName || "Group";
  const avatarRaw = pickGroupAvatarRaw(g, groupId);
  return {
    id: groupId,
    groupId,
    chatId: g.chatId ?? g.ChatId ?? null,
    name,
    groupCode: g.groupCode || g.GroupCode || "",
    description: g.description || g.Description || "",
    createdBy: g.createdBy ?? g.CreatedBy,
    createdAt: g.createdAt || g.CreatedAt,
    isAdmin: Boolean(g.isAdmin ?? g.IsAdmin),
    isActive: g.isActive ?? g.IsActive ?? true,
    initials: initialsFromName(name),
    color: colorForId(groupId),
    profilePic: avatarRaw,
    avatarRaw,
    avatarSrc: resolveGroupAvatarSrc(avatarRaw),
    preview: "",
    time: g.createdAt || g.CreatedAt ? formatMsgTime(g.createdAt || g.CreatedAt) : "",
    unread: Math.max(
      0,
      Number(g.unreadCount ?? g.UnreadCount ?? g.unread ?? 0) || 0
    ),
    members: 0,
  };
};

const apiErrorMessage = (error, fallback) =>
  error?.message ||
  error?.data?.message ||
  error?.response?.data?.message ||
  fallback;

const extractChatId = (response) => {
  const raw =
    response?.chatId ??
    response?.ChatId ??
    response?.data?.chatId ??
    response?.data?.ChatId ??
    null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const GROUP_AVATAR_STORAGE_KEY = "chatGroupAvatars";

const readGroupAvatarMap = () => {
  try {
    return JSON.parse(localStorage.getItem(GROUP_AVATAR_STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
};

const getStoredGroupAvatar = (groupId) => {
  if (groupId == null || groupId === "") return null;
  const value = readGroupAvatarMap()[String(groupId)];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const setStoredGroupAvatar = (groupId, pathOrUrl) => {
  if (groupId == null || groupId === "") return null;
  const value = String(pathOrUrl || "").trim();
  if (!value) return null;
  const map = readGroupAvatarMap();
  map[String(groupId)] = value;
  localStorage.setItem(GROUP_AVATAR_STORAGE_KEY, JSON.stringify(map));
  return value;
};

const pickGroupAvatarRaw = (g, groupId) =>
  g?.profilePic ||
  g?.ProfilePic ||
  g?.profile_pic ||
  g?.avatarUrl ||
  g?.AvatarUrl ||
  g?.groupImageUrl ||
  g?.GroupImageUrl ||
  g?.iconUrl ||
  g?.IconUrl ||
  g?.photoUrl ||
  g?.PhotoUrl ||
  getStoredGroupAvatar(groupId) ||
  null;

const resolveGroupAvatarSrc = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || /^data:/i.test(value) || value.startsWith("blob:")) {
    return value;
  }
  return resolveChatAttachmentUrl(value) || value;
};

const Groups = () => {
  document.title = "Groups | Chat | SoftOnCloud";

  const me = useMemo(() => getSessionUserIdentity(), []);
  const userChatShow = useRef(null);
  const emojiPickerRef = useRef(null);
  const attachMenuRef = useRef(null);
  const attachFileInputRef = useRef(null);
  const groupAvatarInputRef = useRef(null);
  const pendingAttachKindRef = useRef(null);
  const messageScrollRef = useRef(null);
  const activeGroupRef = useRef(null);
  const markReadInFlightRef = useRef(new Set());

  const [activeTab, setActiveTab] = useState("1");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMenu, setSearchMenu] = useState(false);
  const [settingsMenu, setSettingsMenu] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoView, setInfoView] = useState("main"); // main | members | media | starred
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [emojiPicker, setEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [curMessage, setCurMessage] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [showCopyAlert, setShowCopyAlert] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [forwardSelectedIds, setForwardSelectedIds] = useState([]);
  const [forwardSearch, setForwardSearch] = useState("");
  const [forwarding, setForwarding] = useState(false);
  const [forwardGroups, setForwardGroups] = useState([]);
  const [forwardGroupsLoading, setForwardGroupsLoading] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deletingMessages, setDeletingMessages] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deletedForMeIds, setDeletedForMeIds] = useState(
    () => new Set(readDeletedForMeIds(me?.userId))
  );
  const [downloadedAttachments, setDownloadedAttachments] = useState(
    () => new Set(readDownloadedAttachments())
  );
  const [downloadingAttachments, setDownloadingAttachments] = useState(
    () => new Set()
  );
  const [reactionPickerMsg, setReactionPickerMsg] = useState(null);
  const [reactionDetailsMsg, setReactionDetailsMsg] = useState(null);
  const [reactionPickerPos, setReactionPickerPos] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  /** groupId → Set of typing userIds */
  const [groupTypingMap, setGroupTypingMap] = useState({});
  const groupTypingTimersRef = useRef({});
  const lastGroupTypingSentRef = useRef(0);
  const [actionToast, setActionToast] = useState("");
  const draftInputRef = useRef(null);
  const reactionPickerRef = useRef(null);
  const ignoreReactionOutsideRef = useRef(false);
  const seenLiveMessageIdsRef = useRef(new Set());
  const location = useLocation();
  const navigate = useNavigate();

  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState("");
  const [groupList, setGroupList] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [groupDetails, setGroupDetails] = useState(null);
  const [mergedMembers, setMergedMembers] = useState([]);

  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [productUsers, setProductUsers] = useState([]);

  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [messages, setMessages] = useState([]);
  const [focusMessageId, setFocusMessageId] = useState(null);
  const [dateFormat, setDateFormat] = useState(() => getChatDateFormat());
  const [sending, setSending] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createUserSearch, setCreateUserSearch] = useState("");
  const [createSelectedIds, setCreateSelectedIds] = useState([]);
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addUserSearch, setAddUserSearch] = useState("");
  const [addSelectedIds, setAddSelectedIds] = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);

  const [busyAction, setBusyAction] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);

  const showToast = useCallback((message) => {
    setActionToast(message);
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setActionToast(""), 2800);
  }, []);

  const {
    message: messageInfoMsg,
    members: messageInfoMembers,
    onlineIds: messageInfoOnlineIds,
    loading: messageInfoLoading,
    loadError: messageInfoLoadError,
    open: openMessageInfo,
    close: closeMessageInfo,
    clearIfMessage: clearMessageInfoIfMessage,
  } = useGroupMessageInfo({
    me,
    mergedMembers,
    onlineUserIds,
    onBeforeOpen: () => setInfoOpen(false),
    onError: (msg) => showToast(msg),
  });

  const scrollMessagesToBottom = useCallback(() => {
    const el = messageScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const loadProductUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const orgId = getSessionPublicOrgId();
      const productId = getConfiguredProductId();
      if (!orgId || !productId) {
        throw new Error("Organisation or product id missing from session.");
      }
      const response = await getOrganisationProductUsers(orgId, productId);
      const rows = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.users)
            ? response.users
            : [];
      setProductUsers(rows.map((u) => mapSoftOnCloudUser(u, me)).filter((u) => u.userId > 0));
    } catch (error) {
      setUsersError(apiErrorMessage(error, "Unable to load users."));
      setProductUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [me]);

  const userById = useMemo(() => {
    const map = new Map();
    productUsers.forEach((u) => map.set(String(u.userId), u));
    return map;
  }, [productUsers]);

  const mergeMembers = useCallback(
    (details) => {
      const members = Array.isArray(details?.members)
        ? details.members
        : Array.isArray(details?.Members)
          ? details.Members
          : [];
      return members
        .map((m) => {
          const userId = Number(m.userId ?? m.UserId);
          const profile = userById.get(String(userId));
          return {
            userId,
            isAdmin: Boolean(m.isAdmin ?? m.IsAdmin),
            joinedAt: m.joinedAt || m.JoinedAt || null,
            isActive: m.isActive ?? m.IsActive ?? true,
            name: profile?.name || `User ${userId}`,
            email: profile?.email || "",
            phone: profile?.phone || "",
            avatarSrc: profile?.avatarSrc || getCommAvatarSrc(userId),
            isSelf: profile?.isSelf || String(me?.userId) === String(userId),
            status:
              profile?.status ||
              m.presenceStatus ||
              m.PresenceStatus ||
              m.userStatus ||
              m.UserStatus ||
              m.status ||
              m.Status ||
              null,
          };
        })
        .filter((m) => m.userId > 0);
    },
    [userById, me?.userId]
  );

  const loadGroups = useCallback(
    async ({ selectGroupId = null, keepSelected = true } = {}) => {
      setGroupsLoading(true);
      setGroupsError("");
      try {
        const rows = await getGroups();
        let mapped = (rows || []).map(mapGroupListItem);

        if (!mapped.length) {
          setGroupList([]);
          setActiveGroup(null);
          setGroupDetails(null);
          setMergedMembers([]);
          setMessages([]);
          setGroupsUnreadTotal(0);
          return mapped;
        }

        let next = null;
        if (selectGroupId) {
          next = mapped.find((g) => String(g.groupId) === String(selectGroupId)) || null;
        } else if (keepSelected && activeGroup?.groupId) {
          next =
            mapped.find((g) => String(g.groupId) === String(activeGroup.groupId)) ||
            null;
        }
        // Do not auto-open first group — keeps green unread badges visible (like Messages).
        setGroupList(mapped);
        setActiveGroup(next);
        setGroupsUnreadTotal(sumGroupListUnread(mapped));
        return mapped;
      } catch (error) {
        setGroupsError(apiErrorMessage(error, "Unable to load groups."));
        setGroupList([]);
        setActiveGroup(null);
        setGroupsUnreadTotal(0);
        return [];
      } finally {
        setGroupsLoading(false);
      }
    },
    [activeGroup?.groupId]
  );

  const loadGroupDetails = useCallback(
    async (groupId) => {
      if (!groupId) return null;
      setDetailsLoading(true);
      setDetailsError("");
      try {
        const details = await getGroupDetails(groupId);
        setGroupDetails(details);
        const members = mergeMembers(details);
        setMergedMembers(members);
        setGroupList((prev) =>
          prev.map((g) =>
            String(g.groupId) === String(groupId)
              ? {
                  ...g,
                  name: details.groupName || details.GroupName || g.name,
                  description: details.description || details.Description || "",
                  groupCode: details.groupCode || details.GroupCode || g.groupCode,
                  chatId: details.chatId ?? details.ChatId ?? g.chatId,
                  members: members.length,
                  initials: initialsFromName(
                    details.groupName || details.GroupName || g.name
                  ),
                  profilePic:
                    details.profilePic ||
                    details.ProfilePic ||
                    details.profile_pic ||
                    g.profilePic ||
                    null,
                  avatarRaw:
                    pickGroupAvatarRaw(details, groupId) || g.avatarRaw || null,
                  avatarSrc: resolveGroupAvatarSrc(
                    pickGroupAvatarRaw(details, groupId) || g.avatarRaw || null
                  ),
                }
              : g
          )
        );
        setActiveGroup((prev) =>
          prev && String(prev.groupId) === String(groupId)
            ? {
                ...prev,
                name: details.groupName || details.GroupName || prev.name,
                description: details.description || details.Description || "",
                groupCode: details.groupCode || details.GroupCode || prev.groupCode,
                chatId: details.chatId ?? details.ChatId ?? prev.chatId,
                members: members.length,
                isAdmin:
                  members.find((m) => String(m.userId) === String(me?.userId))?.isAdmin ??
                  prev.isAdmin,
                profilePic:
                  details.profilePic ||
                  details.ProfilePic ||
                  details.profile_pic ||
                  prev.profilePic ||
                  null,
                avatarRaw:
                  pickGroupAvatarRaw(details, groupId) || prev.avatarRaw || null,
                avatarSrc: resolveGroupAvatarSrc(
                  pickGroupAvatarRaw(details, groupId) || prev.avatarRaw || null
                ),
              }
            : prev
        );
        return details;
      } catch (error) {
        setDetailsError(apiErrorMessage(error, "Unable to load group details."));
        setGroupDetails(null);
        setMergedMembers([]);
        return null;
      } finally {
        setDetailsLoading(false);
      }
    },
    [mergeMembers, me?.userId]
  );

  const mapApiMessage = useCallback(
    (row) => {
      const senderId = Number(row.senderUserId ?? row.SenderUserId);
      const isMe = String(senderId) === String(me?.userId);
      const profile = userById.get(String(senderId));
      const body = row.messageBody ?? row.MessageBody ?? "";
      const attachmentPaths = [
        row.attachmentPath1 || row.AttachmentPath1,
        row.attachmentPath2 || row.AttachmentPath2,
        row.attachmentPath3 || row.AttachmentPath3,
        row.attachmentPath4 || row.AttachmentPath4,
        row.attachmentPath5 || row.AttachmentPath5,
      ]
        .map((p) => (p ? String(p).trim() : ""))
        .filter(Boolean);

      const primaryPath = attachmentPaths[0] || null;
      const classified = primaryPath
        ? classifyAttachment(primaryPath, body)
        : null;
      const fileName =
        classified?.fileName ||
        (primaryPath ? String(primaryPath).split("/").pop() : null);

      const linkUrls = [];
      const bodyText = String(body || "");
      const urlMatches = bodyText.match(URL_IN_TEXT_RE);
      if (urlMatches) {
        urlMatches.forEach((u) => {
          if (!linkUrls.includes(u)) linkUrls.push(u);
        });
      }

      const myReactionCode =
        row.myReactionCode ||
        row.MyReactionCode ||
        row.reactionCode ||
        row.ReactionCode ||
        null;
      const myReactionEmoji =
        row.myReaction ||
        row.MyReaction ||
        reactionCodeToEmoji(myReactionCode);
      const peerReactionCodeRaw =
        row.peerReactionCode || row.PeerReactionCode || null;
      const peerReactionEmoji =
        row.peerReaction ||
        row.PeerReaction ||
        (peerReactionCodeRaw
          ? reactionCodeToEmoji(peerReactionCodeRaw)
          : null);

      const parentRaw =
        row.parentMessageId ?? row.ParentMessageId ?? null;
      const parentNum = Number(parentRaw);
      const parentMessageId =
        Number.isFinite(parentNum) && parentNum > 0 ? parentNum : null;

      const sentAt =
        row.sentAt || row.SentAt || row.createdAt || row.CreatedAt || null;
      const readAt = row.readAt || row.ReadAt || null;

      const starredBySender = Boolean(
        row.isStarredBySender ?? row.IsStarredBySender
      );
      const starredByReceiver = Boolean(
        row.isStarredByReceiver ?? row.IsStarredByReceiver
      );
      const isStarredByMeRaw = row.isStarredByMe ?? row.IsStarredByMe;
      const starred =
        isStarredByMeRaw === undefined || isStarredByMeRaw === null
          ? isMe
            ? starredBySender
            : starredByReceiver
          : Boolean(isStarredByMeRaw);

      const forwardedFrom =
        row.forwardedFromMessageId ?? row.ForwardedFromMessageId ?? null;

      return {
        id: row.messageId ?? row.MessageId,
        from: isMe ? "me" : "them",
        sender: isMe ? "You" : profile?.name || `User ${senderId}`,
        senderUserId: senderId,
        avatarId: senderId,
        avatarSrc:
          profile?.avatarSrc ||
          resolveUserAvatarUrl(senderId, null) ||
          getCommAvatarSrc(senderId),
        text: body,
        time: formatMsgTime(sentAt),
        sentAt,
        readAt,
        read: Boolean(readAt),
        status: readAt ? MSG_STATUS.READ : MSG_STATUS.SENT,
        type: attachmentPaths.length
          ? "file"
          : linkUrls.length
            ? "link"
            : "text",
        attachKind: classified?.kind || (primaryPath ? "document" : null),
        mediaSubtype: classified?.mediaSubtype || null,
        fileName,
        attachmentPath1: primaryPath,
        attachmentPaths,
        attachmentUrl: primaryPath
          ? resolveChatAttachmentUrl(primaryPath)
          : null,
        linkUrls,
        linkUrl: linkUrls[0] || null,
        parentMessageId,
        replyTo: null,
        starred,
        starredAt: isMe
          ? row.starredBySenderAt ?? row.StarredBySenderAt ?? null
          : row.starredByReceiverAt ?? row.StarredByReceiverAt ?? null,
        forwarded: Boolean(forwardedFrom),
        forwardedFrom,
        forwardedFromMessageId: forwardedFrom,
        reactionCode: myReactionCode
          ? String(myReactionCode).toUpperCase()
          : null,
        peerReactionCode: peerReactionCodeRaw
          ? String(peerReactionCodeRaw).toUpperCase()
          : null,
        peerReaction: peerReactionEmoji || null,
        reaction: joinReactionEmojis(myReactionEmoji, peerReactionEmoji),
        raw: row,
      };
    },
    [me?.userId, userById]
  );

  const loadGroupMessages = useCallback(
    async (chatId) => {
      if (!chatId) {
        setMessages([]);
        setMessagesError("");
        return;
      }
      setMessagesLoading(true);
      setMessagesError("");
      try {
        const rows = await getChatMessages(chatId);
        const mapped = attachReplyPreviews((rows || []).map(mapApiMessage));
        setMessages(mapped);
        // Ack delivery for inbound messages (Message Info: Delivered to).
        const myId = String(me?.userId ?? "");
        mapped.forEach((m) => {
          if (!m?.id || m.from === "me") return;
          const senderId = String(
            m.senderUserId ?? m.raw?.senderUserId ?? m.raw?.SenderUserId ?? ""
          );
          if (senderId && senderId !== myId) {
            ackChatMessageDelivered(m.id, senderId, chatId);
          }
        });
        // Persist group receipts so Message Info can show Read by / Delivered to.
        try {
          await markChatMessagesRead(chatId);
          setGroupList((prev) =>
            prev.map((g) =>
              String(g.chatId) === String(chatId) ? { ...g, unread: 0 } : g
            )
          );
        } catch (readErr) {
          console.warn("markChatMessagesRead failed:", readErr);
        }
      } catch (error) {
        setMessages([]);
        setMessagesError(
          apiErrorMessage(error, "Unable to load media and links.")
        );
        showToast(apiErrorMessage(error, "Unable to load group messages."));
      } finally {
        setMessagesLoading(false);
      }
    },
    [mapApiMessage, showToast, me?.userId]
  );

  // Keep sidebar Groups red badge in sync with list green counts.
  useEffect(() => {
    setGroupsUnreadTotal(sumGroupListUnread(groupList));
  }, [groupList]);

  useEffect(() => {
    loadProductUsers();
    loadGroups({ keepSelected: false });
  }, []);

  // Page-level presence (member online/offline in Group info)
  useEffect(() => {
    const unsubscribe = subscribeChatPresence((event, payload) => {
      if (event === "OnlineUsers") {
        const ids = Array.isArray(payload)
          ? payload.map((id) => String(id))
          : [];
        setOnlineUserIds(new Set(ids));
        return;
      }
      if (event === "UserOnline") {
        const id = String(payload);
        setOnlineUserIds((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        return;
      }
      if (event === "UserOffline") {
        const id = String(payload);
        setOnlineUserIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
    return () => unsubscribe?.();
  }, []);

  // Live: another user created a group and added me → refresh list immediately.
  useEffect(() => {
    const unsubscribe = subscribeChatPresence((event, payload) => {
      if (event === "GroupCreated") {
        loadGroups({ keepSelected: true });
        return;
      }
      if (event === "GroupMemberAdminChanged") {
        const gid = payload?.groupId ?? payload?.GroupId;
        // Update list Admin badge without full page refresh.
        loadGroups({ keepSelected: true });
        const currentId = activeGroupRef.current?.groupId;
        if (
          gid != null &&
          currentId != null &&
          String(gid) === String(currentId)
        ) {
          loadGroupDetails(currentId);
        }
        return;
      }
      if (event !== "ReceiveNotification" || !payload) return;
      const type = String(
        payload.notificationType ?? payload.NotificationType ?? ""
      ).toUpperCase();
      const refType = String(
        payload.referenceType ?? payload.ReferenceType ?? ""
      );
      const groupId = payload.groupId ?? payload.GroupId;
      const isGroupInvite =
        type === "GROUP" ||
        /^GROUP:\d+$/i.test(refType.trim()) ||
        (groupId != null && groupId !== "");
      if (isGroupInvite && type === "GROUP") {
        loadGroups({ keepSelected: true });
        if (
          groupId != null &&
          activeGroupRef.current?.groupId != null &&
          String(groupId) === String(activeGroupRef.current.groupId)
        ) {
          loadGroupDetails(activeGroupRef.current.groupId);
        }
      }
    });
    return () => unsubscribe?.();
  }, [loadGroups, loadGroupDetails]);

  useEffect(() => {
    activeGroupRef.current = activeGroup;
  }, [activeGroup]);

  // When demo user / member opens group (or returns to tab) → mark read for Message Info.
  useEffect(() => {
    const markOpenGroupRead = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const chatId = Number(activeGroupRef.current?.chatId);
      if (!Number.isFinite(chatId) || chatId <= 0) return;
      const key = String(chatId);
      if (markReadInFlightRef.current.has(key)) return;
      markReadInFlightRef.current.add(key);
      try {
        await markChatMessagesRead(chatId);
        setGroupList((prev) =>
          prev.map((g) =>
            String(g.chatId) === key ? { ...g, unread: 0 } : g
          )
        );
      } catch (readErr) {
        console.warn("markChatMessagesRead (visibility) failed:", readErr);
      } finally {
        markReadInFlightRef.current.delete(key);
      }
    };

    markOpenGroupRead();
    const onVisibility = () => {
      if (!document.hidden) markOpenGroupRead();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [activeGroup?.chatId]);

  // Restore / persist composer draft per group (left without sending).
  useEffect(() => {
    if (!activeGroup?.groupId) {
      setCurMessage("");
      return;
    }
    setCurMessage(getComposerDraft(groupDraftKey(activeGroup.groupId)));
  }, [activeGroup?.groupId]);

  useEffect(() => {
    if (!activeGroup?.groupId) return undefined;
    const key = groupDraftKey(activeGroup.groupId);
    const timer = window.setTimeout(() => {
      setComposerDraft(key, curMessage, {
        type: "group",
        name: activeGroup?.name || "",
        photo: activeGroup?.avatarUrl || activeGroup?.photoUrl || null,
        href: "/communication/groups",
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    curMessage,
    activeGroup?.groupId,
    activeGroup?.name,
    activeGroup?.avatarUrl,
    activeGroup?.photoUrl,
  ]);

  useEffect(() => {
    if (!activeGroup?.groupId) return;
    loadGroupDetails(activeGroup.groupId);
    loadGroupMessages(activeGroup.chatId);
  }, [activeGroup?.groupId, activeGroup?.chatId, loadGroupDetails, loadGroupMessages]);

  useEffect(() => {
    const groupId = activeGroup?.groupId;
    if (!groupId) return undefined;

    let cancelled = false;
    joinGroupHub(groupId);

    const unsubscribe = subscribeChatPresence(async (event, payload) => {
      if (cancelled) return;

      if (event === "OnlineUsers") {
        const ids = Array.isArray(payload)
          ? payload.map((id) => String(id))
          : [];
        setOnlineUserIds(new Set(ids));
        return;
      }
      if (event === "UserOnline") {
        const id = String(payload);
        setOnlineUserIds((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        return;
      }
      if (event === "UserOffline") {
        const id = String(payload);
        setOnlineUserIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        return;
      }

      if (event === "GroupTyping") {
        const fromId = String(payload?.userId ?? payload?.UserId ?? "");
        const gid = String(payload?.groupId ?? payload?.GroupId ?? "");
        if (!fromId || !gid || String(fromId) === String(me?.userId)) return;
        const isTyping = Boolean(
          payload?.isTyping ?? payload?.IsTyping ?? true
        );
        const timerKey = `${gid}:${fromId}`;
        const timers = groupTypingTimersRef.current;
        if (timers[timerKey]) {
          window.clearTimeout(timers[timerKey]);
          delete timers[timerKey];
        }
        setGroupTypingMap((prev) => {
          const current = new Set(prev[gid] || []);
          if (isTyping) current.add(fromId);
          else current.delete(fromId);
          if (!current.size) {
            if (!prev[gid]) return prev;
            const next = { ...prev };
            delete next[gid];
            return next;
          }
          return { ...prev, [gid]: current };
        });
        if (isTyping) {
          timers[timerKey] = window.setTimeout(() => {
            setGroupTypingMap((prev) => {
              const current = new Set(prev[gid] || []);
              if (!current.has(fromId)) return prev;
              current.delete(fromId);
              if (!current.size) {
                const next = { ...prev };
                delete next[gid];
                return next;
              }
              return { ...prev, [gid]: current };
            });
            delete timers[timerKey];
          }, 3000);
        }
        return;
      }

      const current = activeGroupRef.current;
      if (!current?.groupId) return;

      if (event === "MessageDelivered") {
        if (!payload || me?.userId == null) return;
        const messageId = String(
          payload.messageId ?? payload.MessageId ?? ""
        );
        if (!messageId) return;
        const payloadChatId = payload.chatId ?? payload.ChatId;
        if (
          payloadChatId != null &&
          current.chatId != null &&
          String(payloadChatId) !== String(current.chatId)
        ) {
          return;
        }
        setMessages((prev) => {
          let changed = false;
          const next = prev.map((m) => {
            if (String(m.id) !== messageId || m.from !== "me") return m;
            if (
              m.status === MSG_STATUS.READ ||
              m.status === MSG_STATUS.DELIVERED
            ) {
              return m;
            }
            changed = true;
            return { ...m, status: MSG_STATUS.DELIVERED };
          });
          return changed ? next : prev;
        });
        return;
      }

      if (event === "MessagesRead") {
        if (!payload || me?.userId == null) return;
        const readerId = String(
          payload.readerUserId ?? payload.ReaderUserId ?? ""
        );
        if (readerId && readerId === String(me.userId)) return;
        const messageIds = (
          payload.messageIds ??
          payload.MessageIds ??
          []
        ).map((id) => String(id));
        const payloadChatId = payload.chatId ?? payload.ChatId;
        if (
          payloadChatId != null &&
          current.chatId != null &&
          String(payloadChatId) !== String(current.chatId) &&
          messageIds.length === 0
        ) {
          return;
        }
        const readAt =
          payload.readAt ?? payload.ReadAt ?? new Date().toISOString();
        setMessages((prev) => {
          let changed = false;
          const next = prev.map((m) => {
            if (m.from !== "me") return m;
            if (messageIds.length && !messageIds.includes(String(m.id))) {
              return m;
            }
            if (
              !messageIds.length &&
              payloadChatId != null &&
              current.chatId != null &&
              String(payloadChatId) !== String(current.chatId)
            ) {
              return m;
            }
            if (m.status === MSG_STATUS.READ && m.readAt) return m;
            changed = true;
            return {
              ...m,
              status: MSG_STATUS.READ,
              read: true,
              readAt,
            };
          });
          return changed ? next : prev;
        });
        return;
      }

      if (event === "MessageReaction") {
        if (!payload || me?.userId == null) return;
        const messageId = String(
          payload.messageId ?? payload.MessageId ?? ""
        );
        if (!messageId) return;
        const reactorId = String(
          payload.reactorUserId ?? payload.ReactorUserId ?? ""
        );
        const reactionCodeRaw =
          payload.reactionCode ?? payload.ReactionCode ?? null;
        const reactionCode =
          reactionCodeRaw == null || String(reactionCodeRaw).trim() === ""
            ? null
            : normalizeReactionCode(reactionCodeRaw);
        const reactionEmoji =
          payload.reaction ??
          payload.Reaction ??
          payload.reactionEmoji ??
          payload.ReactionEmoji ??
          (reactionCode ? reactionCodeToEmoji(reactionCode) : null);
        const isMine = reactorId === String(me.userId);

        setMessages((prev) => {
          if (!prev.some((m) => String(m.id) === messageId)) return prev;

          let needsReload = false;
          const next = prev.map((m) => {
            if (String(m.id) !== messageId) return m;
            if (isMine) {
              return patchMessageReactions(m, {
                reactionCode,
                myEmoji: reactionEmoji,
              });
            }
            if (!reactionCode && !reactionEmoji) {
              needsReload = true;
              return patchMessageReactions(m, {
                peerReactionCode: null,
                peerReaction: null,
              });
            }
            return patchMessageReactions(m, {
              peerReactionCode: reactionCode,
              peerReaction: reactionEmoji || m.peerReaction,
            });
          });
          if (needsReload && current.chatId) {
            window.setTimeout(() => loadGroupMessages(current.chatId), 0);
          }
          return next;
        });
        return;
      }

      if (event === "MessageDeleted") {
        const messageId = String(
          payload?.messageId ?? payload?.MessageId ?? ""
        );
        if (!messageId) return;
        const payloadGroupId = payload?.groupId ?? payload?.GroupId;
        const payloadChatId = payload?.chatId ?? payload?.ChatId;
        const matchesGroup =
          payloadGroupId != null &&
          String(payloadGroupId) === String(current.groupId);
        const matchesChat =
          current.chatId != null &&
          String(payloadChatId) === String(current.chatId);
        if (!matchesGroup && !matchesChat) return;
        setMessages((prev) =>
          prev.filter((m) => String(m.id) !== messageId)
        );
        setSelectedMessageIds((prev) =>
          prev.filter((id) => String(id) !== messageId)
        );
        clearMessageInfoIfMessage(messageId);
        return;
      }

      // ReceiveMessage handled by page-level listener (unread badges + open chat).
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
      leaveGroupHub(groupId);
    };
  }, [
    activeGroup?.groupId,
    mapApiMessage,
    me?.userId,
    loadGroupMessages,
    clearMessageInfoIfMessage,
  ]);

  // Live group messages for list green badges + open thread (user hub + group hub).
  // Reaction: toast via SignalR MessageReaction (bell still gets ReceiveNotification).
  useEffect(() => {
    const unsubscribe = subscribeChatPresence(async (event, payload) => {
      if (event === "MessageReaction" && payload) {
        const reactorId = String(
          payload.reactorUserId ?? payload.ReactorUserId ?? ""
        );
        const myId = String(me?.userId ?? "");
        const senderOfMessage = String(
          payload.senderUserId ?? payload.SenderUserId ?? ""
        );
        const reactionCodeRaw =
          payload.reactionCode ?? payload.ReactionCode ?? null;
        const hasReaction =
          reactionCodeRaw != null && String(reactionCodeRaw).trim() !== "";
        const reactionEmoji =
          payload.reaction ??
          payload.Reaction ??
          payload.reactionEmoji ??
          payload.ReactionEmoji ??
          "👍";
        if (
          hasReaction &&
          myId &&
          reactorId !== myId &&
          senderOfMessage === myId
        ) {
          showToast(`${reactionEmoji} reacted to your message`);
        }
        return;
      }

      if (event !== "ReceiveMessage" || !payload) return;

      const payloadGroupId = payload.groupId ?? payload.GroupId;
      if (payloadGroupId == null || payloadGroupId === "") return;

      const messageId = String(
        payload.messageId ?? payload.MessageId ?? ""
      );
      if (messageId) {
        if (seenLiveMessageIdsRef.current.has(messageId)) return;
        seenLiveMessageIdsRef.current.add(messageId);
        if (seenLiveMessageIdsRef.current.size > 300) {
          seenLiveMessageIdsRef.current = new Set(
            [...seenLiveMessageIdsRef.current].slice(-150)
          );
        }
      }

      const current = activeGroupRef.current;
      const tabVisible =
        typeof document === "undefined" ? true : !document.hidden;
      const viewingThisGroup =
        current?.groupId != null &&
        String(payloadGroupId) === String(current.groupId) &&
        tabVisible;

      const uiMsg = mapApiMessage(payload);
      const isFromMe = uiMsg.from === "me";
      const previewText =
        uiMsg.type === "file"
          ? uiMsg.fileName || "Attachment"
          : uiMsg.text || "";

      // Delivery ack (Message Info) — online receive ≠ read.
      if (!isFromMe) {
        const incomingChatId = Number(payload.chatId ?? payload.ChatId ?? 0);
        const senderId = String(
          payload.senderUserId ?? payload.SenderUserId ?? ""
        );
        if (Number.isFinite(incomingChatId) && incomingChatId > 0 && senderId) {
          ackChatMessageDelivered(uiMsg.id, senderId, incomingChatId);
        }
      }

      setGroupList((prev) => {
        const exists = prev.some(
          (g) => String(g.groupId) === String(payloadGroupId)
        );
        if (!exists) return prev;
        return prev.map((g) => {
          if (String(g.groupId) !== String(payloadGroupId)) return g;
          return {
            ...g,
            preview: previewText
              ? `${uiMsg.sender}: ${previewText}`.slice(0, 80)
              : g.preview,
            time: uiMsg.time || g.time,
            unread:
              viewingThisGroup || isFromMe
                ? 0
                : Number(g.unread || 0) + 1,
          };
        });
      });

      if (!viewingThisGroup) return;

      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(uiMsg.id))) return prev;
        return attachReplyPreviews([...prev, uiMsg]);
      });
      if (!isFromMe && current?.chatId) {
        try {
          await markChatMessagesRead(current.chatId);
        } catch (readErr) {
          console.warn("markChatMessagesRead (live) failed:", readErr);
        }
      }
    });

    return unsubscribe;
  }, [mapApiMessage, me?.userId, showToast]);

  const memberPresenceStatus = useCallback(
    (member) => {
      if (!member) return "offline";
      const raw = String(
        member.presenceStatus ||
          member.status ||
          member.userStatus ||
          ""
      )
        .trim()
        .toLowerCase();
      if (raw === "away" || raw === "busy") return "away";
      if (member.isSelf) return "online";
      if (raw === "online") return "online";
      if (raw === "offline") {
        return onlineUserIds.has(String(member.userId)) ? "online" : "offline";
      }
      return onlineUserIds.has(String(member.userId)) ? "online" : "offline";
    },
    [onlineUserIds]
  );

  const renderMemberPresenceBadge = (member) => {
    const status = memberPresenceStatus(member);
    return (
      <span
        className={classnames("comm-gi-presence-badge", {
          "is-online": status === "online",
          "is-away": status === "away",
          "is-offline": status === "offline",
        })}
      >
        {status}
      </span>
    );
  };

  useEffect(() => {
    if (!groupDetails) return;
    setMergedMembers(mergeMembers(groupDetails));
  }, [productUsers, groupDetails, mergeMembers]);

  useEffect(() => {
    scrollMessagesToBottom();
  }, [messages, activeGroup?.groupId, scrollMessagesToBottom]);

  useEffect(() => {
    const onDocMouseDown = (event) => {
      if (
        emojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setEmojiPicker(false);
      }
      if (
        showAttachMenu &&
        attachMenuRef.current &&
        !attachMenuRef.current.contains(event.target)
      ) {
        setShowAttachMenu(false);
      }
      if (
        reactionPickerMsg &&
        !ignoreReactionOutsideRef.current &&
        !event.target.closest?.(".comm-reaction-emoji-picker") &&
        !event.target.closest?.(".comm-react-plus")
      ) {
        setReactionPickerMsg(null);
        setReactionPickerPos(null);
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setEmojiPicker(false);
        setShowAttachMenu(false);
        setReactionPickerMsg(null);
        setReactionPickerPos(null);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [emojiPicker, showAttachMenu, reactionPickerMsg]);

  useEffect(() => {
    setReactionPickerMsg(null);
    setReactionPickerPos(null);
  }, [activeGroup?.groupId]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = groupList;
    // Both tabs use GET /api/chat/groups (user's active groups). No separate All Groups API.
    if (activeTab === "2") {
      list = groupList.filter((g) => g.isAdmin);
    }
    if (!q) return list;
    return list.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        String(g.groupCode || "")
          .toLowerCase()
          .includes(q)
    );
  }, [activeTab, searchQuery, groupList]);

  const isCurrentAdmin = useMemo(() => {
    if (activeGroup?.isAdmin) return true;
    return mergedMembers.some((m) => m.isSelf && m.isAdmin);
  }, [activeGroup?.isAdmin, mergedMembers]);

  const sortedMembers = useMemo(() => {
    const list = [...mergedMembers];
    list.sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    return list;
  }, [mergedMembers]);

  const filteredInfoMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return sortedMembers;
    return sortedMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        String(m.email || "")
          .toLowerCase()
          .includes(q) ||
        String(m.phone || "").includes(q)
    );
  }, [sortedMembers, memberSearch]);

  const groupSharedItems = useMemo(() => {
    const seen = new Set();
    const list = [];

    const pushItem = (item) => {
      const key = `${item.kind}:${item.url || item.fileName}:${item.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push(item);
    };

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      const paths = Array.isArray(msg?.attachmentPaths)
        ? msg.attachmentPaths
        : msg?.attachmentPath1
          ? [msg.attachmentPath1]
          : [];

      paths.forEach((path, idx) => {
        const classified = classifyAttachment(path, msg.text);
        const fileName =
          classified.fileName || String(path).split("/").pop() || "Attachment";
        const isMedia =
          classified.kind === "media" ||
          classified.kind === "audio" ||
          classified.mediaSubtype === "photo" ||
          classified.mediaSubtype === "video";
        pushItem({
          id: `${msg.id}-${idx}`,
          messageId: String(msg.id),
          kind: isMedia
            ? classified.kind === "audio"
              ? "audio"
              : "media"
            : "document",
          mediaSubtype: classified.mediaSubtype || null,
          fileName,
          url: resolveChatAttachmentUrl(path),
          path,
          icon: attachmentIconForFileName(fileName),
          time: msg.time || "",
          message: msg,
        });
      });

      (msg?.linkUrls || (msg?.linkUrl ? [msg.linkUrl] : [])).forEach(
        (linkUrl, idx) => {
          pushItem({
            id: `${msg.id}-link-${idx}`,
            messageId: String(msg.id),
            kind: "link",
            mediaSubtype: null,
            fileName: linkUrl,
            url: linkUrl,
            path: null,
            icon: "ri-link",
            time: msg.time || "",
            message: msg,
          });
        }
      );
    }
    return list;
  }, [messages]);

  const groupMediaItems = useMemo(
    () =>
      groupSharedItems.filter(
        (item) => item.kind === "media" || item.kind === "audio"
      ),
    [groupSharedItems]
  );

  const groupDocumentItems = useMemo(
    () => groupSharedItems.filter((item) => item.kind === "document"),
    [groupSharedItems]
  );

  const groupLinkItems = useMemo(
    () => groupSharedItems.filter((item) => item.kind === "link"),
    [groupSharedItems]
  );

  const groupMediaThumbs = useMemo(
    () =>
      groupMediaItems.filter(
        (item) =>
          item.mediaSubtype === "photo" ||
          item.mediaSubtype === "video" ||
          item.kind === "media"
      ),
    [groupMediaItems]
  );

  const groupStarredMessages = useMemo(
    () =>
      messages.filter(
        (m) => Boolean(m.starred) && !deletedForMeIds.has(String(m.id))
      ),
    [messages, deletedForMeIds]
  );

  const openMediaView = () => {
    setInfoView("media");
    setInfoOpen(true);
    if (activeGroup?.chatId && messagesError) {
      loadGroupMessages(activeGroup.chatId);
    }
  };

  const openStarredView = () => {
    setInfoView("starred");
    setInfoOpen(true);
  };

  const openGroupInfo = () => {
    setInfoView("main");
    setMemberSearch("");
    setMemberSearchOpen(false);
    setInfoOpen(true);
  };

  const openGroup = (group) => {
    setActiveGroup(group);
    if (group?.groupId != null) {
      setGroupList((prev) => {
        const next = prev.map((g) =>
          String(g.groupId) === String(group.groupId)
            ? { ...g, unread: 0 }
            : g
        );
        setGroupsUnreadTotal(sumGroupListUnread(next));
        return next;
      });
    }
    setInfoOpen(false);
    setInfoView("main");
    setEmojiPicker(false);
    setShowAttachMenu(false);
    setReplyTo(null);
    setForwardMessage(null);
    setForwardSelectedIds([]);
    setForwardSearch("");
    setSelectMode(false);
    setSelectedMessageIds([]);
    setDeleteDialog(null);
    closeMessageInfo();
    if (window.innerWidth < 992 && userChatShow.current) {
      userChatShow.current.classList.add("user-chat-show");
    }
  };

  // Open group from bell / desktop notification (navigate state / session).
  useEffect(() => {
    const openGroupId =
      location.state?.openGroupId ??
      (() => {
        try {
          const raw = sessionStorage.getItem("chatUiState");
          const parsed = raw ? JSON.parse(raw) : null;
          return parsed?.openGroupId || null;
        } catch {
          return null;
        }
      })();
    const focusFromNav =
      location.state?.focusMessageId ??
      (() => {
        try {
          const raw = sessionStorage.getItem("chatUiState");
          const parsed = raw ? JSON.parse(raw) : null;
          return parsed?.focusMessageId || null;
        } catch {
          return null;
        }
      })();
    if (openGroupId == null || !groupList.length) return;
    const target = groupList.find(
      (g) => String(g.groupId) === String(openGroupId)
    );
    if (!target) return;
    openGroup(target);
    if (focusFromNav != null && focusFromNav !== "") {
      setFocusMessageId(String(focusFromNav));
    }
    try {
      const prev = JSON.parse(sessionStorage.getItem("chatUiState") || "null") || {};
      const { openGroupId: _omit, focusMessageId: _focus, ...rest } = prev;
      sessionStorage.setItem("chatUiState", JSON.stringify(rest));
    } catch {
      // ignore
    }
    if (
      location.state?.openGroupId != null ||
      location.state?.focusMessageId != null
    ) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [groupList, location.state?.openGroupId, location.state?.focusMessageId]);

  // Scroll to message after desktop / bell notification redirect
  useEffect(() => {
    if (!focusMessageId || messagesLoading) return;
    const hasTarget = messages.some(
      (m) => String(m.id) === String(focusMessageId)
    );
    if (!hasTarget) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`group-msg-${focusMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("is-focused-msg");
        window.setTimeout(() => el.classList.remove("is-focused-msg"), 2000);
      }
      setFocusMessageId(null);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusMessageId, messagesLoading, messages]);

  const backToList = () => {
    if (userChatShow.current) {
      userChatShow.current.classList.remove("user-chat-show");
    }
  };

  const openCreateModal = () => {
    setCreateName("");
    setCreateDescription("");
    setCreateUserSearch("");
    setCreateSelectedIds([]);
    setCreateOpen(true);
    if (!productUsers.length && !usersLoading) loadProductUsers();
  };

  const toggleCreateUser = (userId) => {
    setCreateSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const createSelectableUsers = useMemo(() => {
    const q = createUserSearch.trim().toLowerCase();
    return productUsers.filter((u) => {
      if (u.isSelf) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        String(u.email || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [productUsers, createUserSearch]);

  const handleCreateGroup = async () => {
    if (creating) return;
    const name = createName.trim();
    if (!name) {
      showToast("Group name is required.");
      return;
    }
    setCreating(true);
    try {
      const created = await createGroup({
        groupName: name,
        groupCode: makeGroupCode(name),
        description: createDescription.trim() || null,
        memberUserIds: createSelectedIds,
      });
      const newId = created?.groupId ?? created?.GroupId;
      setCreateOpen(false);
      showToast("Group created");
      await loadGroups({ selectGroupId: newId, keepSelected: false });
      if (newId) await loadGroupDetails(newId);
    } catch (error) {
      showToast(apiErrorMessage(error, "Unable to create group."));
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = () => {
    setEditName(activeGroup?.name || "");
    setEditDescription(activeGroup?.description || "");
    setEditOpen(true);
  };

  const applyGroupAvatar = useCallback((groupId, rawPath) => {
    const saved = String(rawPath || "").trim();
    if (saved) setStoredGroupAvatar(groupId, saved);
    const src = resolveGroupAvatarSrc(saved);
    setGroupList((prev) =>
      prev.map((g) =>
        String(g.groupId) === String(groupId)
          ? { ...g, avatarRaw: saved || null, avatarSrc: src, profilePic: saved || null }
          : g
      )
    );
    setActiveGroup((prev) =>
      prev && String(prev.groupId) === String(groupId)
        ? {
            ...prev,
            avatarRaw: saved || null,
            avatarSrc: src,
            profilePic: saved || null,
          }
        : prev
    );
    return src;
  }, []);

  const handleGroupAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !activeGroup?.groupId) return;
    if (!isCurrentAdmin) {
      showToast("Only group admins can change the group photo.");
      return;
    }
    if (!String(file.type || "").startsWith("image/")) {
      showToast("Please choose an image file.");
      return;
    }
    const maxMb = DEFAULT_CHAT_MAX_FILE_SIZE_MB;
    if (file.size > maxMb * 1024 * 1024) {
      showToast(`Image size cannot exceed ${maxMb} MB.`);
      return;
    }

    setAvatarSaving(true);
    try {
      const uploaded = await uploadChatAttachments(file);
      const path =
        uploaded?.attachmentPath1 ||
        uploaded?.data?.attachmentPath1 ||
        uploaded?.files?.[0]?.filePath ||
        uploaded?.data?.files?.[0]?.filePath ||
        uploaded?.paths?.[0] ||
        null;
      if (!path) {
        showToast("Upload succeeded but no file path was returned.");
        return;
      }

      const updated = await updateGroup(activeGroup.groupId, {
        groupName: activeGroup.name,
        description: activeGroup.description || null,
        profilePic: path,
      });

      const savedPath = String(
        updated?.profilePic ||
          updated?.ProfilePic ||
          updated?.profile_pic ||
          ""
      ).trim();

      if (!savedPath) {
        showToast(
          "Photo uploaded but profile_pic was not saved in DB. Restart Chat API and try again."
        );
        return;
      }

      applyGroupAvatar(activeGroup.groupId, savedPath);
      showToast("Group photo updated");
    } catch (error) {
      showToast(apiErrorMessage(error, "Unable to update group photo."));
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (savingEdit || !activeGroup?.groupId) return;
    const name = editName.trim();
    if (!name) {
      showToast("Group name is required.");
      return;
    }
    setSavingEdit(true);
    try {
      await updateGroup(activeGroup.groupId, {
        groupName: name,
        description: editDescription.trim() || null,
      });
      setEditOpen(false);
      showToast("Group updated");
      await loadGroups({ selectGroupId: activeGroup.groupId });
      await loadGroupDetails(activeGroup.groupId);
    } catch (error) {
      showToast(apiErrorMessage(error, "Unable to update group."));
    } finally {
      setSavingEdit(false);
    }
  };

  const openAddMembers = () => {
    setAddSelectedIds([]);
    setAddUserSearch("");
    setAddOpen(true);
    if (!productUsers.length && !usersLoading) loadProductUsers();
  };

  const activeMemberIds = useMemo(
    () => new Set(mergedMembers.filter((m) => m.isActive).map((m) => String(m.userId))),
    [mergedMembers]
  );

  const addSelectableUsers = useMemo(() => {
    const q = addUserSearch.trim().toLowerCase();
    return productUsers.filter((u) => {
      if (activeMemberIds.has(String(u.userId))) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        String(u.email || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [productUsers, addUserSearch, activeMemberIds]);

  const handleAddMembers = async () => {
    if (addingMembers || !activeGroup?.groupId) return;
    if (!addSelectedIds.length) {
      showToast("Select at least one member.");
      return;
    }
    setAddingMembers(true);
    try {
      await addGroupMembers(activeGroup.groupId, addSelectedIds);
      setAddOpen(false);
      showToast("Members added");
      await loadGroupDetails(activeGroup.groupId);
    } catch (error) {
      showToast(apiErrorMessage(error, "Unable to add members."));
    } finally {
      setAddingMembers(false);
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if (!activeGroup?.groupId || busyAction) return;
    if (!window.confirm("Remove this member from the group?")) return;
    setBusyAction("remove");
    try {
      await removeGroupMember(activeGroup.groupId, targetUserId);
      showToast("Member removed");
      await loadGroupDetails(activeGroup.groupId);
    } catch (error) {
      showToast(apiErrorMessage(error, "Unable to remove member."));
    } finally {
      setBusyAction("");
    }
  };

  const handleSetMemberAdmin = async (targetUserId, makeAdmin) => {
    if (!activeGroup?.groupId || busyAction) return;
    const isSelf = String(targetUserId) === String(me?.userId ?? "");
    const label = makeAdmin ? "Make group admin" : "Dismiss as admin";
    if (
      !window.confirm(
        makeAdmin
          ? "Make this member a group admin?"
          : isSelf
            ? "Leave admin role? (You will stay in the group as a member.)"
            : "Dismiss this member as admin?"
      )
    ) {
      return;
    }
    setBusyAction("admin");
    try {
      await setGroupMemberAdmin(activeGroup.groupId, targetUserId, makeAdmin);
      showToast(
        makeAdmin
          ? "Member is now an admin"
          : isSelf
            ? "You are no longer an admin"
            : "Admin role removed"
      );
      await loadGroupDetails(activeGroup.groupId);
      await loadGroups({ keepSelected: true });
    } catch (error) {
      const raw = apiErrorMessage(error, `Unable to ${label.toLowerCase()}.`);
      const friendly = /last active admin/i.test(String(raw || ""))
        ? "Cannot dismiss the last admin. Make another member admin first."
        : raw;
      showToast(friendly);
    } finally {
      setBusyAction("");
    }
  };

  const openLeaveDialog = () => {
    if (!activeGroup?.groupId || busyAction) return;
    setLeaveDialogOpen(true);
  };

  const closeLeaveDialog = () => {
    if (busyAction === "leave") return;
    setLeaveDialogOpen(false);
  };

  const confirmLeaveGroup = async () => {
    if (!activeGroup?.groupId || busyAction) return;
    const leftId = activeGroup.groupId;
    setBusyAction("leave");
    try {
      await leaveGroup(leftId);
      setLeaveDialogOpen(false);
      showToast("Left group");
      setInfoOpen(false);
      const mapped = await loadGroups({ keepSelected: false });
      if (mapped.length) {
        setActiveGroup(mapped[0]);
      } else {
        setActiveGroup(null);
        setGroupDetails(null);
        setMergedMembers([]);
        setMessages([]);
      }
    } catch (error) {
      const raw = apiErrorMessage(error, "Unable to leave group.");
      const friendly = /last active admin/i.test(String(raw || ""))
        ? "You are the only admin. Promote another member to admin before leaving."
        : raw;
      showToast(friendly);
    } finally {
      setBusyAction("");
    }
  };

  const handleLeaveGroup = () => {
    openLeaveDialog();
  };

  const onEmojiClick = (emojiData) => {
    const emoji = emojiData?.emoji || "";
    if (!emoji) return;
    setCurMessage((prev) => `${prev || ""}${emoji}`);
  };

  const openAttachPicker = (itemId) => {
    const item = attachMenuItems.find((entry) => entry.id === itemId);
    if (!item || !attachFileInputRef.current) return;
    pendingAttachKindRef.current = item.id;
    attachFileInputRef.current.accept = item.accept;
    attachFileInputRef.current.value = "";
    setShowAttachMenu(false);
    setEmojiPicker(false);
    attachFileInputRef.current.click();
  };

  const sendOutbound = async ({
    messageBody,
    messageTypeId = 1,
    attachmentPath1 = null,
    parentMessageId = null,
  }) => {
    if (!activeGroup?.chatId || !activeGroup?.groupId) {
      showToast("Group chat is not ready yet.");
      return false;
    }
    setSending(true);
    try {
      const saved = await sendChatMessage(activeGroup.chatId, {
        groupId: activeGroup.groupId,
        messageBody,
        messageTypeId,
        attachmentPath1,
        parentMessageId: parentMessageId || undefined,
      });
      let uiMsg = mapApiMessage(saved);
      if (parentMessageId) {
        uiMsg = {
          ...uiMsg,
          parentMessageId,
          replyTo: uiMsg.replyTo || null,
        };
      }
      setMessages((prev) => {
        const withReply = attachReplyPreviews(
          prev.some((m) => String(m.id) === String(uiMsg.id))
            ? prev
            : [...prev, uiMsg]
        );
        return withReply;
      });
      const previewText =
        uiMsg.type === "file"
          ? uiMsg.fileName || "Attachment"
          : uiMsg.text || "";
      setGroupList((prev) =>
        prev.map((g) =>
          String(g.groupId) === String(activeGroup.groupId)
            ? {
                ...g,
                preview: previewText
                  ? `${uiMsg.sender}: ${previewText}`.slice(0, 80)
                  : g.preview,
                time: uiMsg.time || g.time,
              }
            : g
        )
      );
      return true;
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to send message."));
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleAttachFileChange = async (event) => {
    const file = event.target.files?.[0];
    const kind = pendingAttachKindRef.current;
    event.target.value = "";
    pendingAttachKindRef.current = null;
    if (!file || !kind) return;

    const maxMb = DEFAULT_CHAT_MAX_FILE_SIZE_MB;
    if (file.size > maxMb * 1024 * 1024) {
      showToast(`File size cannot exceed ${maxMb} MB.`);
      return;
    }

    setSending(true);
    try {
      const uploaded = await uploadChatAttachments(file);
      const path = pickUploadedAttachmentPath(uploaded);
      if (!path) {
        showToast("Upload succeeded but no file path was returned.");
        return;
      }
      await sendOutbound({
        messageBody: formatGroupAttachMessageBody(kind, file.name),
        messageTypeId: attachKindToMessageTypeId(kind),
        attachmentPath1: path,
        parentMessageId: replyTo?.id || null,
      });
      setReplyTo(null);
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to upload file."));
    } finally {
      setSending(false);
    }
  };

  const activeGroupTypingIds = useMemo(() => {
    if (!activeGroup?.groupId) return [];
    const set = groupTypingMap[String(activeGroup.groupId)];
    return set ? Array.from(set) : [];
  }, [activeGroup?.groupId, groupTypingMap]);

  const activeGroupTypingLabel = useMemo(() => {
    if (!activeGroupTypingIds.length) return "";
    const names = activeGroupTypingIds
      .map((id) => {
        const member = mergedMembers.find(
          (m) => String(m.userId ?? m.id) === String(id)
        );
        return (
          member?.name ||
          member?.fullName ||
          member?.displayName ||
          "Someone"
        );
      })
      .filter(Boolean);
    if (!names.length) return "typing...";
    if (names.length === 1) return `${names[0]} typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} typing...`;
    return "Several people typing...";
  }, [activeGroupTypingIds, mergedMembers]);

  const notifyGroupTyping = useCallback(
    (isTyping) => {
      const groupId = Number(activeGroup?.groupId);
      if (!Number.isFinite(groupId) || groupId <= 0) return;
      const now = Date.now();
      if (isTyping) {
        if (now - lastGroupTypingSentRef.current < 1500) return;
        lastGroupTypingSentRef.current = now;
      } else {
        lastGroupTypingSentRef.current = 0;
      }
      sendGroupChatTyping(groupId, isTyping);
    },
    [activeGroup?.groupId]
  );

  useEffect(() => {
    return () => {
      if (!activeGroup?.groupId) return;
      sendGroupChatTyping(Number(activeGroup.groupId), false);
    };
  }, [activeGroup?.groupId]);

  const sendMessage = async (e) => {
    e?.preventDefault?.();
    const text = curMessage.trim();
    if (!text || sending) return;
    const ok = await sendOutbound({
      messageBody: text,
      messageTypeId: 1,
      parentMessageId: replyTo?.id || null,
    });
    if (ok) {
      setCurMessage("");
      notifyGroupTyping(false);
      if (activeGroup?.groupId) {
        clearComposerDraft(groupDraftKey(activeGroup.groupId));
      }
      setReplyTo(null);
      setEmojiPicker(false);
      setShowAttachMenu(false);
    }
  };

  const toggleGroupReaction = async (msg, reactionCodeOrEmoji) => {
    const code = normalizeReactionCode(reactionCodeOrEmoji);
    if (!code) {
      showToast(
        "Invalid reaction. Allowed: LIKE, LOVE, LAUGH, WOW, SAD, THANKS."
      );
      return;
    }
    const messageId = Number(
      msg?.raw?.messageId ?? msg?.raw?.MessageId ?? msg?.id
    );
    if (!Number.isFinite(messageId) || messageId <= 0) return;

    const nextCode = msg.reactionCode === code ? null : code;
    const nextEmoji = nextCode ? reactionCodeToEmoji(nextCode) : null;
    const previousCode = msg.reactionCode || null;
    const previousMyEmoji = previousCode
      ? reactionCodeToEmoji(previousCode)
      : null;

    setMessages((prev) =>
      prev.map((m) =>
        String(m.id) === String(msg.id)
          ? patchMessageReactions(m, {
              reactionCode: nextCode,
              myEmoji: nextEmoji,
            })
          : m
      )
    );
    setReactionPickerMsg(null);
    setReactionPickerPos(null);

    try {
      const result = await toggleChatMessageReaction(messageId, nextCode);
      const confirmedCodeRaw =
        result?.reactionCode ?? result?.ReactionCode ?? nextCode;
      const confirmedCode =
        confirmedCodeRaw == null || String(confirmedCodeRaw).trim() === ""
          ? null
          : normalizeReactionCode(confirmedCodeRaw);
      const confirmedEmoji =
        result?.reaction ??
        result?.Reaction ??
        (confirmedCode ? reactionCodeToEmoji(confirmedCode) : null);
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id) === String(msg.id)
            ? patchMessageReactions(m, {
                reactionCode: confirmedCode,
                myEmoji: confirmedEmoji,
              })
            : m
        )
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id) === String(msg.id)
            ? patchMessageReactions(m, {
                reactionCode: previousCode,
                myEmoji: previousMyEmoji,
              })
            : m
        )
      );
      showToast(apiErrorMessage(error, "Failed to save reaction."));
    }
  };

  const openReactionEmojiPicker = (msg, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setEmojiPicker(false);
    setShowAttachMenu(false);

    const rect = e?.currentTarget?.getBoundingClientRect?.();
    const pickerW = 320;
    const pickerH = 360;
    const gap = 8;
    if (rect) {
      const left = Math.min(
        Math.max(8, rect.right - pickerW),
        window.innerWidth - pickerW - 8
      );
      let top = rect.top - pickerH - gap;
      if (top < 8) top = Math.min(rect.bottom + gap, window.innerHeight - pickerH - 8);
      setReactionPickerPos({ top, left });
    } else {
      setReactionPickerPos({ top: 96, left: 96 });
    }

    ignoreReactionOutsideRef.current = true;
    setReactionPickerMsg(msg || null);
    window.setTimeout(() => {
      try {
        document.body.click();
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        ignoreReactionOutsideRef.current = false;
      }, 80);
    }, 0);
  };

  const onReactionEmojiClick = (emojiData) => {
    const emoji = emojiData?.emoji || "";
    const code = emojiToReactionCode(emoji);
    if (!reactionPickerMsg) return;
    if (!code) {
      showToast("Only 👍 ❤️ 😂 😮 😢 🙏 reactions are allowed.");
      return;
    }
    toggleGroupReaction(reactionPickerMsg, code);
    setReactionPickerMsg(null);
    setReactionPickerPos(null);
  };

  const getMessageAttachmentPath = (msg) =>
    msg?.attachmentPath1 ||
    msg?.raw?.attachmentPath1 ||
    msg?.raw?.AttachmentPath1 ||
    msg?.raw?.attachment_path_1 ||
    (Array.isArray(msg?.attachmentPaths) ? msg.attachmentPaths[0] : null) ||
    null;

  const isAttachmentDownloaded = (msg) => {
    // Own sends are already on this device — same as One-to-One.
    if (msg?.from === "me") return true;
    const key = getAttachmentStorageKey(msg);
    return key ? downloadedAttachments.has(key) : false;
  };

  const markAttachmentDownloaded = (msg) => {
    const key = getAttachmentStorageKey(msg);
    if (!key) return;
    setDownloadedAttachments((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      writeDownloadedAttachments(next);
      return next;
    });
  };

  const openChatAttachment = (msg) => {
    const path = getMessageAttachmentPath(msg);
    const url = resolveChatAttachmentUrl(path);
    if (!url) {
      showToast("File path not available");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadGroupAttachment = async (msg) => {
    const path = getMessageAttachmentPath(msg);
    const key = getAttachmentStorageKey(msg);
    if (!path) {
      showToast("File path not available for download");
      return;
    }
    const fileName =
      msg?.fileName || String(path).split("/").pop() || "attachment";

    if (key) {
      setDownloadingAttachments((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }

    const clearDownloading = () => {
      if (!key) return;
      setDownloadingAttachments((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    };

    try {
      const blob = await fetchChatAttachmentBlob(path);
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("Empty download response.");
      }
      if (blob.type && blob.type.includes("application/json")) {
        throw new Error("Download failed (server returned an error).");
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      markAttachmentDownloaded(msg);
    } catch (error) {
      console.error("Attachment download failed:", error);
      showToast(apiErrorMessage(error, "Download failed. Please try again."));
    } finally {
      clearDownloading();
    }
  };

  const handleAttachmentClick = (msg) => {
    if (!getMessageAttachmentPath(msg)) {
      showToast("File path not available for download");
      return;
    }
    const isMedia =
      msg?.mediaSubtype === "photo" || msg?.mediaSubtype === "video";
    if (isMedia && isAttachmentDownloaded(msg)) {
      openChatAttachment(msg);
      return;
    }
    if (!isAttachmentDownloaded(msg)) {
      downloadGroupAttachment(msg);
      return;
    }
    openChatAttachment(msg);
  };

  const jumpToRepliedMessage = (msg, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const targetId = String(
      msg?.replyTo?.id ?? msg?.parentMessageId ?? ""
    ).trim();
    if (!targetId || targetId === "null" || targetId === "undefined") {
      showToast("Original message not found in this chat.");
      return;
    }

    const exists = messages.some((m) => String(m.id) === targetId);
    if (!exists) {
      showToast("Original message not found in this chat.");
      return;
    }

    const el = document.getElementById(`group-msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("is-focused-msg");
      window.clearTimeout(jumpToRepliedMessage._highlightTimer);
      jumpToRepliedMessage._highlightTimer = window.setTimeout(() => {
        el.classList.remove("is-focused-msg");
      }, 1800);
      return;
    }
    showToast("Original message not found in this chat.");
  };

  const handleGroupMessageAction = async (actionId, msg) => {
    if (!msg) return;
    try {
      document.body.click();
    } catch {
      /* ignore */
    }
    switch (actionId) {
      case "reply":
        setReplyTo(msg);
        window.setTimeout(() => draftInputRef.current?.focus(), 0);
        break;
      case "copy": {
        const text =
          msg.type === "file" ? msg.fileName || "" : msg.text || "";
        if (!text) {
          showToast("Nothing to copy");
          break;
        }
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).then(
            () => {
              setShowCopyAlert(true);
              window.setTimeout(() => setShowCopyAlert(false), 2000);
            },
            () => showToast("Copy failed")
          );
        } else {
          showToast("Clipboard unavailable");
        }
        break;
      }
      case "download":
        await downloadGroupAttachment(msg);
        break;
      case "forward":
        openForwardModal(msg);
        break;
      case "star": {
        const messageId = Number(
          msg?.raw?.messageId ?? msg?.raw?.MessageId ?? msg?.id
        );
        if (!Number.isFinite(messageId) || messageId <= 0) {
          showToast("Cannot star this message (missing message id).");
          break;
        }
        const nextStar = !msg.starred;
        const previousStar = Boolean(msg.starred);
        setMessages((prev) =>
          prev.map((m) =>
            String(m.id) === String(msg.id) ? { ...m, starred: nextStar } : m
          )
        );
        try {
          const result = await toggleChatMessageStar(messageId, nextStar);
          const confirmed = Boolean(
            result?.isStarredByMe ?? result?.IsStarredByMe ?? nextStar
          );
          const starredAt =
            result?.starredAt ?? result?.StarredAt ?? null;
          setMessages((prev) =>
            prev.map((m) =>
              String(m.id) === String(msg.id)
                ? { ...m, starred: confirmed, starredAt }
                : m
            )
          );
          showToast(confirmed ? "Starred" : "Removed from starred");
        } catch (error) {
          setMessages((prev) =>
            prev.map((m) =>
              String(m.id) === String(msg.id)
                ? { ...m, starred: previousStar }
                : m
            )
          );
          showToast(apiErrorMessage(error, "Failed to update star."));
        }
        break;
      }
      case "more":
        setSelectMode(true);
        setSelectedMessageIds([msg.id]);
        break;
      case "info":
        // Close message menu, then open WhatsApp-style Message Info panel.
        try {
          document.body.click();
        } catch {
          /* ignore */
        }
        openMessageInfo(msg);
        break;
      case "delete":
        setDeleteDialog({ messages: [msg] });
        break;
      default:
        break;
    }
  };

  const toggleMessageSelect = (messageId) => {
    const id = String(messageId);
    setSelectedMessageIds((prev) =>
      prev.map(String).includes(id)
        ? prev.filter((x) => String(x) !== id)
        : [...prev, messageId]
    );
  };

  const closeDeleteDialog = () => {
    if (deletingMessages) return;
    setDeleteDialog(null);
  };

  const removeMessagesFromList = (msgs) => {
    if (!msgs?.length) return;
    const ids = new Set(msgs.map((m) => String(m.id)));
    setMessages((prev) => prev.filter((m) => !ids.has(String(m.id))));
    setSelectedMessageIds((prev) => prev.filter((id) => !ids.has(String(id))));
    setSelectMode(false);
  };

  const markMessagesDeletedForMe = (msgs) => {
    const ids = msgs.map((m) => String(m.id)).filter(Boolean);
    if (!ids.length) return;
    setDeletedForMeIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      writeDeletedForMeIds(me?.userId, next);
      return next;
    });
    setSelectedMessageIds((prev) =>
      prev.filter((id) => !ids.includes(String(id)))
    );
    setSelectMode(false);
  };

  const handleDeleteForMe = () => {
    const msgs = deleteDialog?.messages || [];
    if (!msgs.length || deletingMessages) return;
    markMessagesDeletedForMe(msgs);
    setDeleteDialog(null);
    showToast(
      msgs.length === 1 ? "Message deleted for you" : "Messages deleted for you"
    );
  };

  const handleDeleteForEveryone = async () => {
    const msgs = (deleteDialog?.messages || []).filter((m) => m.from === "me");
    if (!msgs.length || deletingMessages) return;

    setDeletingMessages(true);
    let deleted = 0;
    const failed = [];

    try {
      for (const msg of msgs) {
        const messageId = Number(
          msg?.raw?.messageId ?? msg?.raw?.MessageId ?? msg?.id
        );
        if (!Number.isFinite(messageId) || messageId <= 0) {
          failed.push(msg.id);
          continue;
        }
        try {
          await deleteChatMessage(messageId);
          deleted += 1;
        } catch {
          failed.push(msg.id);
        }
      }

      if (deleted > 0) {
        const ok = msgs.filter((m) => !failed.includes(m.id));
        removeMessagesFromList(ok);
        showToast(
          deleted === 1
            ? "Message deleted for everyone"
            : `${deleted} messages deleted for everyone`
        );
      }
      if (failed.length) {
        showToast(
          deleted
            ? `Deleted with ${failed.length} failure(s)`
            : "Failed to delete message(s)"
        );
      } else {
        setDeleteDialog(null);
      }
    } finally {
      setDeletingMessages(false);
    }
  };

  const loadForwardGroups = useCallback(async () => {
    setForwardGroupsLoading(true);
    try {
      const rows = await getGroups();
      const mapped = (rows || [])
        .map((g) => {
          const groupId = Number(g.groupId ?? g.GroupId);
          const chatId = Number(g.chatId ?? g.ChatId);
          if (!Number.isFinite(groupId) || groupId <= 0) return null;
          if (!Number.isFinite(chatId) || chatId <= 0) return null;
          const name = g.groupName || g.GroupName || "Group";
          const avatarRaw = pickGroupAvatarRaw(g, groupId);
          return {
            targetType: "group",
            targetKey: `g:${groupId}`,
            id: `group-${groupId}`,
            groupId,
            chatId,
            name,
            email: "Group",
            avatarSrc:
              resolveGroupAvatarSrc(avatarRaw) || getCommAvatarSrc(groupId),
          };
        })
        .filter(Boolean);
      setForwardGroups(mapped);
    } catch (error) {
      console.warn("loadForwardGroups failed:", error);
      setForwardGroups([]);
    } finally {
      setForwardGroupsLoading(false);
    }
  }, []);

  const forwardCandidates = useMemo(() => {
    const q = forwardSearch.trim().toLowerCase();
    const users = productUsers
      .filter((u) => !u.isSelf)
      .map((u) => ({
        ...u,
        targetType: "user",
        targetKey: `u:${u.userId}`,
        id: u.userId,
      }));
    const combined = [...users, ...forwardGroups];
    if (!q) return combined;
    return combined.filter(
      (item) =>
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.email || "").toLowerCase().includes(q)
    );
  }, [productUsers, forwardGroups, forwardSearch]);

  const toggleForwardTarget = (targetKey) => {
    const id = String(targetKey);
    setForwardSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const closeForwardModal = () => {
    if (forwarding) return;
    setForwardMessage(null);
    setForwardSelectedIds([]);
    setForwardSearch("");
  };

  const openForwardModal = (msg) => {
    setForwardMessage(msg);
    setForwardSelectedIds([]);
    setForwardSearch("");
    if (!productUsers.length && !usersLoading) loadProductUsers();
    loadForwardGroups();
  };

  const confirmForwardMessages = async () => {
    if (!forwardMessage || !forwardSelectedIds.length || forwarding) return;

    const myUserId = Number(me?.userId);
    if (!Number.isFinite(myUserId) || myUserId <= 0) {
      showToast("Logged-in user id missing from session/JWT.");
      return;
    }

    const originalMessageId = Number(
      forwardMessage?.raw?.messageId ??
        forwardMessage?.raw?.MessageId ??
        forwardMessage?.id
    );
    if (!Number.isFinite(originalMessageId) || originalMessageId <= 0) {
      showToast("Message id missing — cannot forward");
      return;
    }

    const selectedTargets = forwardCandidates.filter((c) =>
      forwardSelectedIds.includes(String(c.targetKey))
    );
    if (!selectedTargets.length) {
      showToast("Select at least one chat or group.");
      return;
    }

    setForwarding(true);
    let successCount = 0;
    const errors = [];

    try {
      for (const target of selectedTargets) {
        try {
          if (target.targetType === "group") {
            const destinationChatId = Number(target.chatId);
            const groupId = Number(target.groupId);
            if (!Number.isFinite(destinationChatId) || destinationChatId <= 0) {
              throw new Error("Group chatId missing.");
            }
            await forwardChatMessage(originalMessageId, {
              destinationChatId,
              groupId,
            });
            successCount += 1;
            continue;
          }

          const receiverUserId = Number(
            target.userId ??
              (String(target.targetKey || "").startsWith("u:")
                ? String(target.targetKey).slice(2)
                : target.id)
          );
          if (!Number.isFinite(receiverUserId) || receiverUserId <= 0) {
            errors.push(target.targetKey || String(receiverUserId));
            continue;
          }
          const privateChat = await getOrCreatePrivateChat(
            myUserId,
            receiverUserId
          );
          const destinationChatId = extractChatId(privateChat);
          if (!destinationChatId) {
            throw new Error("Get/Create Chat did not return chatId.");
          }
          await forwardChatMessage(originalMessageId, {
            destinationChatId,
            receiverUserId,
          });
          successCount += 1;
        } catch (err) {
          console.error("Forward failed:", err);
          errors.push(
            apiErrorMessage(err, target.targetKey || "unknown")
          );
        }
      }

      if (successCount > 0) {
        showToast(
          successCount === 1
            ? "Message forwarded"
            : `Message forwarded to ${successCount} chats`
        );
        setForwardMessage(null);
        setForwardSelectedIds([]);
        setForwardSearch("");
      }
      if (errors.length) {
        showToast(
          successCount
            ? `Forwarded with ${errors.length} failure(s)`
            : apiErrorMessage(
                { message: errors[0] },
                "Unable to forward message."
              )
        );
      }
    } finally {
      setForwarding(false);
    }
  };

  const visibleMessages = useMemo(() => {
    const list = messages.filter((msg) => !deletedForMeIds.has(String(msg.id)));
    return withGroupDateSeparators(list, dateFormat);
  }, [messages, deletedForMeIds, dateFormat]);

  const renderGroupMessageTicks = (msg) => {
    if (msg.from !== "me") return null;
    const status = resolveGroupOutgoingStatus(msg);
    if (status === MSG_STATUS.READ) {
      return (
        <i
          className="ri-check-double-line ticks ticks-read"
          title="Read"
          aria-label="Read"
        />
      );
    }
    if (status === MSG_STATUS.DELIVERED) {
      return (
        <i
          className="ri-check-double-line ticks ticks-delivered"
          title="Delivered"
          aria-label="Delivered"
        />
      );
    }
    return (
      <i
        className="ri-check-line ticks ticks-sent"
        title="Sent"
        aria-label="Sent"
      />
    );
  };

  useEffect(() => {
    const onDateFormatUpdated = (event) => {
      const next = event?.detail?.dateFormat || getChatDateFormat();
      setDateFormat(next);
    };
    window.addEventListener("chat-date-format-updated", onDateFormatUpdated);
    return () =>
      window.removeEventListener("chat-date-format-updated", onDateFormatUpdated);
  }, []);

  const onKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage(e);
    }
  };

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <div className="chat-wrapper d-lg-flex gap-1 mx-n4 mt-n4 p-1">
            <div className="chat-leftsidebar">
              <div className="px-4 pt-4 mb-3">
                <div className="d-flex align-items-start">
                  <div className="flex-grow-1">
                    <h5 className="mb-4">Groups</h5>
                  </div>
                  <div className="flex-shrink-0">
                    <UncontrolledTooltip placement="bottom" target="createGroupBtn">
                      Create group
                    </UncontrolledTooltip>
                    <Button
                      color=""
                      id="createGroupBtn"
                      className="btn btn-soft-success btn-sm shadow-none"
                      type="button"
                      onClick={openCreateModal}
                    >
                      <i className="ri-add-line align-bottom"></i>
                    </Button>
                  </div>
                </div>
                <div className="search-box">
                  <input
                    type="text"
                    className="form-control bg-light border-light"
                    placeholder="Search groups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <i className="ri-search-2-line search-icon"></i>
                </div>
              </div>

              <Nav tabs className="nav nav-tabs nav-tabs-custom nav-success nav-justified mb-3">
                <NavItem>
                  <NavLink
                    style={{ cursor: "pointer" }}
                    className={classnames({ active: activeTab === "1" })}
                    onClick={() => setActiveTab("1")}
                  >
                    All Groups
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    style={{ cursor: "pointer" }}
                    className={classnames({ active: activeTab === "2" })}
                    onClick={() => setActiveTab("2")}
                  >
                    My Groups
                  </NavLink>
                </NavItem>
              </Nav>

              <TabContent activeTab={activeTab} className="text-muted">
                <TabPane tabId={activeTab}>
                  <SimpleBar
                    className="chat-room-list pt-3"
                    style={{ margin: "-16px 0px 0px" }}
                  >
                    <div className="d-flex align-items-center px-4 mb-2">
                      <div className="flex-grow-1">
                        <h4 className="mb-0 fs-11 text-muted text-uppercase">
                          {activeTab === "1" ? "All Groups" : "My Groups"}
                        </h4>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="badge bg-success-subtle text-success">
                          {filteredGroups.length}
                        </span>
                      </div>
                    </div>

                    <div className="chat-message-list">
                      {groupsLoading ? (
                        <div className="text-center py-4 text-muted fs-13">
                          <Spinner size="sm" className="me-2" />
                          Loading groups...
                        </div>
                      ) : groupsError ? (
                        <div className="text-center text-danger py-4 px-3 fs-13">
                          {groupsError}
                          <div className="mt-2">
                            <Button size="sm" color="light" onClick={() => loadGroups()}>
                              Retry
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <ul className="list-unstyled chat-list chat-user-list users-list mb-0">
                          {filteredGroups.map((g) => (
                            <li
                              key={g.groupId}
                              className={classnames({
                                active: activeGroup?.groupId === g.groupId,
                              })}
                            >
                              <Link
                                to="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  openGroup(g);
                                }}
                              >
                                <div className="d-flex align-items-center">
                                  <div className="flex-shrink-0 chat-user-img align-self-center me-2 ms-0">
                                    <div className="avatar-xxs">
                                      {g.avatarSrc ? (
                                        <img
                                          src={g.avatarSrc}
                                          alt=""
                                          className="rounded-circle img-fluid"
                                        />
                                      ) : (
                                        <span
                                          className="avatar-title rounded-circle text-white"
                                          style={{
                                            backgroundColor: g.color,
                                            fontSize: "0.7rem",
                                          }}
                                        >
                                          {g.initials}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex-grow-1 overflow-hidden">
                                    <p className="text-truncate mb-0 fw-medium">{g.name}</p>
                                    <p className="text-truncate text-muted fs-12 mb-0">
                                      {(groupTypingMap[String(g.groupId)]?.size ||
                                        0) > 0 ? (
                                        <span className="text-success">typing...</span>
                                      ) : (
                                        g.preview || g.groupCode || g.description || " "
                                      )}
                                    </p>
                                  </div>
                                  <div className="flex-shrink-0 text-end ms-1">
                                    {g.unread > 0 ? (
                                      <span className="badge bg-success rounded-pill">
                                        {g.unread}
                                      </span>
                                    ) : g.isAdmin ? (
                                      <span className="badge bg-success-subtle text-success">
                                        Admin
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </Link>
                            </li>
                          ))}
                          {!filteredGroups.length && (
                            <li className="text-center text-muted py-4 fs-13">
                              No groups yet
                              <div className="mt-2">
                                <Button
                                  size="sm"
                                  color="success"
                                  outline
                                  onClick={openCreateModal}
                                >
                                  + Create group
                                </Button>
                              </div>
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  </SimpleBar>
                </TabPane>
              </TabContent>
            </div>

            <div className="user-chat w-100 overflow-hidden" ref={userChatShow}>
              <div className="chat-content d-lg-flex">
                <div className="w-100 overflow-hidden position-relative">
                  <div className="position-relative">
                    {activeGroup ? (
                      <>
                        <div className="p-3 user-chat-topbar">
                          <Row className="align-items-center">
                            <Col sm={4} xs={8}>
                              <div className="d-flex align-items-center">
                                <div className="flex-shrink-0 d-block d-lg-none me-3">
                                  <Link
                                    to="#"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      backToList();
                                    }}
                                    className="user-chat-remove fs-18 p-1"
                                  >
                                    <i className="ri-arrow-left-s-line align-bottom"></i>
                                  </Link>
                                </div>
                                <div className="flex-grow-1 overflow-hidden">
                                  <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0 chat-user-img align-self-center me-3 ms-0">
                                      <div className="avatar-xs">
                                        {activeGroup.avatarSrc ? (
                                          <img
                                            src={activeGroup.avatarSrc}
                                            alt=""
                                            className="rounded-circle img-fluid"
                                          />
                                        ) : (
                                          <span
                                            className="avatar-title rounded-circle text-white"
                                            style={{ backgroundColor: activeGroup.color }}
                                          >
                                            {activeGroup.initials}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex-grow-1 overflow-hidden">
                                      <h5 className="text-truncate mb-0 fs-16">
                                        <Link
                                          to="#"
                                          className="text-reset username"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            openGroupInfo();
                                          }}
                                        >
                                          {activeGroup.name}
                                        </Link>
                                      </h5>
                                      <p className="text-truncate text-muted fs-14 mb-0">
                                        <small>
                                          {detailsLoading
                                            ? "Loading group..."
                                            : activeGroupTypingLabel
                                              ? activeGroupTypingLabel
                                              : `${mergedMembers.length || activeGroup.members || 0} Members`}
                                        </small>
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Col>
                            <Col sm={8} xs={4}>
                              <ul className="list-inline user-chat-nav text-end mb-0">
                                <li className="list-inline-item m-0">
                                  <Dropdown
                                    isOpen={searchMenu}
                                    toggle={() => setSearchMenu(!searchMenu)}
                                  >
                                    <DropdownToggle
                                      className="btn btn-ghost-secondary btn-icon"
                                      tag="button"
                                    >
                                      <FeatherIcon icon="search" className="icon-sm" />
                                    </DropdownToggle>
                                    <DropdownMenu className="p-0 dropdown-menu-end dropdown-menu-lg">
                                      <div className="p-2">
                                        <div className="search-box">
                                          <Input
                                            type="text"
                                            className="form-control bg-light border-light"
                                            placeholder="Search messages..."
                                          />
                                          <i className="ri-search-2-line search-icon"></i>
                                        </div>
                                      </div>
                                    </DropdownMenu>
                                  </Dropdown>
                                </li>
                                <li className="list-inline-item d-none d-lg-inline-block m-0">
                                  <button
                                    type="button"
                                    className="btn btn-ghost-secondary btn-icon"
                                    onClick={openGroupInfo}
                                  >
                                    <FeatherIcon icon="info" className="icon-sm" />
                                  </button>
                                </li>
                                <li className="list-inline-item m-0">
                                  <Dropdown
                                    isOpen={settingsMenu}
                                    toggle={() => setSettingsMenu(!settingsMenu)}
                                  >
                                    <DropdownToggle
                                      className="btn btn-ghost-secondary btn-icon"
                                      tag="button"
                                    >
                                      <FeatherIcon icon="more-vertical" className="icon-sm" />
                                    </DropdownToggle>
                                    <DropdownMenu className="dropdown-menu-end">
                                      <DropdownItem
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          openGroupInfo();
                                        }}
                                      >
                                        <i className="ri-group-line align-bottom text-muted me-2"></i>
                                        Group info
                                      </DropdownItem>
                                      {isCurrentAdmin ? (
                                        <>
                                          <DropdownItem
                                            href="#"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              openEditModal();
                                            }}
                                          >
                                            <i className="ri-pencil-line align-bottom text-muted me-2"></i>
                                            Edit Group
                                          </DropdownItem>
                                          <DropdownItem
                                            href="#"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              openAddMembers();
                                            }}
                                          >
                                            <i className="ri-user-add-line align-bottom text-muted me-2"></i>
                                            Add members
                                          </DropdownItem>
                                        </>
                                      ) : null}
                                      <DropdownItem
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          handleLeaveGroup();
                                        }}
                                      >
                                        <i className="ri-logout-box-r-line align-bottom text-muted me-2"></i>
                                        Leave group
                                      </DropdownItem>
                                    </DropdownMenu>
                                  </Dropdown>
                                </li>
                              </ul>
                            </Col>
                          </Row>
                        </div>

                        {selectMode && (
                          <div className="px-3 py-2 bg-light border-bottom d-flex align-items-center justify-content-between">
                            <span className="fs-13">
                              {selectedMessageIds.length} selected
                            </span>
                            <div className="d-flex gap-2">
                              <Button
                                size="sm"
                                color="soft-success"
                                disabled={!selectedMessageIds.length}
                                onClick={() => {
                                  const first = visibleMessages.find(
                                    (msg) =>
                                      !msg.isDateSeparator &&
                                      selectedMessageIds
                                        .map(String)
                                        .includes(String(msg.id))
                                  );
                                  if (!first) return;
                                  openForwardModal(first);
                                }}
                              >
                                Forward
                              </Button>
                              <Button
                                size="sm"
                                color="soft-danger"
                                disabled={!selectedMessageIds.length}
                                onClick={() => {
                                  const selected = visibleMessages.filter(
                                    (msg) =>
                                      !msg.isDateSeparator &&
                                      selectedMessageIds
                                        .map(String)
                                        .includes(String(msg.id))
                                  );
                                  if (!selected.length) {
                                    showToast("No messages selected");
                                    return;
                                  }
                                  setDeleteDialog({ messages: selected });
                                }}
                              >
                                Delete
                              </Button>
                              <Button
                                size="sm"
                                color="light"
                                onClick={() => {
                                  setSelectMode(false);
                                  setSelectedMessageIds([]);
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="position-relative" id="users-chat">
                          {reactionPickerMsg ? (
                            <div
                              ref={reactionPickerRef}
                              className="comm-reaction-emoji-picker is-fixed"
                              role="dialog"
                              aria-label="More reactions"
                              style={{
                                top: reactionPickerPos?.top ?? 96,
                                left: reactionPickerPos?.left ?? 96,
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <Picker
                                onEmojiClick={onReactionEmojiClick}
                                searchDisabled
                                skinTonesDisabled
                                width={320}
                                height={360}
                                previewConfig={{ showPreview: false }}
                              />
                            </div>
                          ) : null}
                          <div className="chat-conversation" id="chat-conversation">
                            <div
                              className="chat-conversation-scroll"
                              ref={messageScrollRef}
                            >
                              {messagesLoading ? (
                                <div className="text-center text-muted py-4 fs-13">
                                  Loading messages...
                                </div>
                              ) : null}
                              {!messagesLoading &&
                              !visibleMessages.some((m) => !m.isDateSeparator) ? (
                                <div className="text-center text-muted py-4 fs-13">
                                  No messages yet.
                                </div>
                              ) : null}
                              <ul
                                className="list-unstyled chat-conversation-list"
                                id="users-conversation"
                              >
                                {visibleMessages.map((msg) => {
                                  if (msg.isDateSeparator) {
                                    return (
                                      <li
                                        key={msg.id}
                                        className="chat-list chat-day-separator"
                                      >
                                        <div className="chat-day-chip">{msg.label}</div>
                                      </li>
                                    );
                                  }
                                  const isMe = msg.from === "me";
                                  const isFile = msg.type === "file" || msg.attachKind;
                                  const isSelected = selectedMessageIds
                                    .map(String)
                                    .includes(String(msg.id));
                                  const fileIcon =
                                    msg.mediaSubtype === "video"
                                      ? "ri-video-fill"
                                      : msg.mediaSubtype === "photo" ||
                                          msg.attachKind === "media"
                                        ? "ri-image-fill"
                                        : msg.attachKind === "audio"
                                          ? "ri-headphone-fill"
                                          : "ri-file-text-line";
                                  const fileLabel =
                                    msg.mediaSubtype === "video"
                                      ? "Video"
                                      : msg.mediaSubtype === "photo"
                                        ? "Photo"
                                        : msg.attachKind === "audio"
                                          ? "Audio"
                                          : msg.attachKind === "media"
                                            ? "Media"
                                            : "Document";
                                  return (
                                    <li
                                      key={msg.id}
                                      id={`group-msg-${msg.id}`}
                                      className={classnames(
                                        "chat-list",
                                        isMe ? "right" : "left",
                                        {
                                          selectable: selectMode,
                                          selected: isSelected,
                                        }
                                      )}
                                      onClick={() => {
                                        if (selectMode) toggleMessageSelect(msg.id);
                                      }}
                                    >
                                      <div className="conversation-list">
                                        {!isMe && (
                                          <div className="chat-avatar">
                                            <img
                                              src={getCommAvatarSrc(
                                                msg.avatarId,
                                                userById.get(
                                                  String(
                                                    msg.senderUserId ||
                                                      msg.avatarId
                                                  )
                                                )?.avatarSrc || msg.avatarSrc
                                              )}
                                              alt=""
                                            />
                                          </div>
                                        )}
                                        <div className="user-chat-content">
                                          <div
                                            className={classnames("ctext-wrap", {
                                              "has-reaction": Boolean(
                                                msg.reaction
                                              ),
                                            })}
                                          >
                                            <div className="ctext-wrap-content">
                                              {msg.forwarded ? (
                                                <small className="d-block text-muted mb-1 fs-11">
                                                  <i className="ri-share-forward-line me-1"></i>
                                                  Forwarded
                                                </small>
                                              ) : null}
                                              {msg.replyTo?.text ||
                                              msg.parentMessageId ? (
                                                <div
                                                  className="replymessage-block mb-2 replymessage-jump"
                                                  role="button"
                                                  tabIndex={0}
                                                  title="Go to original message"
                                                  onMouseDown={(e) =>
                                                    e.stopPropagation()
                                                  }
                                                  onClick={(e) =>
                                                    jumpToRepliedMessage(msg, e)
                                                  }
                                                  onKeyDown={(e) => {
                                                    if (
                                                      e.key === "Enter" ||
                                                      e.key === " "
                                                    ) {
                                                      jumpToRepliedMessage(
                                                        msg,
                                                        e
                                                      );
                                                    }
                                                  }}
                                                >
                                                  <h5 className="conversation-name mb-1">
                                                    {msg.replyTo?.name ||
                                                      "Member"}
                                                  </h5>
                                                  <p className="mb-0 text-truncate">
                                                    {msg.replyTo?.text ||
                                                      "Original message"}
                                                  </p>
                                                </div>
                                              ) : null}
                                              {isFile ? (
                                                (() => {
                                                  const attachPath =
                                                    getMessageAttachmentPath(
                                                      msg
                                                    );
                                                  const attachUrl =
                                                    resolveChatAttachmentUrl(
                                                      attachPath
                                                    );
                                                  const downloaded =
                                                    isAttachmentDownloaded(msg);
                                                  const attachKey =
                                                    getAttachmentStorageKey(
                                                      msg
                                                    );
                                                  const isDownloading =
                                                    attachKey &&
                                                    downloadingAttachments.has(
                                                      attachKey
                                                    );
                                                  const isPhoto =
                                                    downloaded &&
                                                    msg.mediaSubtype ===
                                                      "photo" &&
                                                    Boolean(attachUrl);
                                                  const isVideo =
                                                    downloaded &&
                                                    msg.mediaSubtype ===
                                                      "video" &&
                                                    Boolean(attachUrl);
                                                  const starBadge =
                                                    msg.starred ? (
                                                      <i
                                                        className="ri-star-fill text-warning flex-shrink-0 ms-1"
                                                        title="Starred"
                                                      ></i>
                                                    ) : null;

                                                  if (isPhoto) {
                                                    return (
                                                      <div className="d-flex align-items-start">
                                                        <div
                                                          className="comm-media-preview flex-grow-1"
                                                          role="button"
                                                          title="Open photo"
                                                          onClick={(e) => {
                                                            e.preventDefault();
                                                            openChatAttachment(
                                                              msg
                                                            );
                                                          }}
                                                        >
                                                          <img
                                                            src={attachUrl}
                                                            alt={
                                                              msg.fileName ||
                                                              "Photo"
                                                            }
                                                            className="comm-media-preview-img"
                                                          />
                                                        </div>
                                                        {starBadge}
                                                      </div>
                                                    );
                                                  }

                                                  if (isVideo) {
                                                    return (
                                                      <div className="d-flex align-items-start">
                                                        <div className="comm-media-preview flex-grow-1">
                                                          <video
                                                            src={attachUrl}
                                                            controls
                                                            className="comm-media-preview-video"
                                                            preload="metadata"
                                                          >
                                                            Your browser does
                                                            not support video.
                                                          </video>
                                                        </div>
                                                        {starBadge}
                                                      </div>
                                                    );
                                                  }

                                                  return (
                                                    <div className="d-flex align-items-center">
                                                      <div
                                                        className="d-flex align-items-center gap-2 text-start comm-attach-card flex-grow-1 overflow-hidden"
                                                        role="button"
                                                        title={
                                                          !attachPath
                                                            ? "File unavailable"
                                                            : downloaded
                                                              ? "Open file"
                                                              : "Download file"
                                                        }
                                                        style={{
                                                          cursor: attachPath
                                                            ? "pointer"
                                                            : "default",
                                                        }}
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          if (isDownloading)
                                                            return;
                                                          handleAttachmentClick(
                                                            msg
                                                          );
                                                        }}
                                                      >
                                                        <span className="avatar-xs flex-shrink-0">
                                                          <span className="avatar-title rounded bg-light text-body">
                                                            <i
                                                              className={
                                                                fileIcon
                                                              }
                                                            ></i>
                                                          </span>
                                                        </span>
                                                        <div className="overflow-hidden flex-grow-1">
                                                          <p className="mb-0 ctext-content text-truncate">
                                                            {msg.fileName ||
                                                              fileLabel}
                                                          </p>
                                                          <small className="text-muted text-uppercase">
                                                            {fileLabel}
                                                          </small>
                                                        </div>
                                                        {attachPath &&
                                                        !downloaded ? (
                                                          <span className="comm-attach-action flex-shrink-0">
                                                            {isDownloading ? (
                                                              <i
                                                                className="ri-loader-4-line text-muted"
                                                                title="Downloading..."
                                                              ></i>
                                                            ) : (
                                                              <i
                                                                className="ri-download-2-line text-muted"
                                                                title="Download"
                                                              ></i>
                                                            )}
                                                          </span>
                                                        ) : null}
                                                      </div>
                                                      {starBadge}
                                                    </div>
                                                  );
                                                })()
                                              ) : (
                                                <div className="d-flex align-items-start gap-1">
                                                  <p className="mb-0 ctext-content flex-grow-1">
                                                    {msg.text}
                                                  </p>
                                                  {msg.starred ? (
                                                    <i
                                                      className="ri-star-fill text-warning flex-shrink-0 mt-1"
                                                      title="Starred"
                                                    ></i>
                                                  ) : null}
                                                </div>
                                              )}
                                            </div>
                                            {!selectMode && (
                                            <UncontrolledDropdown className="align-self-start message-box-drop">
                                              <DropdownToggle
                                                href="#"
                                                className="btn nav-btn"
                                                tag="a"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <i className="ri-more-2-fill"></i>
                                              </DropdownToggle>
                                              <DropdownMenu className="dropdown-menu-end comm-msg-menu">
                                                <div className="comm-react-bar">
                                                  {QUICK_REACTIONS.map(
                                                    ({ code, emoji }) => (
                                                      <button
                                                        key={code}
                                                        type="button"
                                                        className={classnames(
                                                          "comm-react-btn",
                                                          {
                                                            active:
                                                              msg.reactionCode ===
                                                              code,
                                                          }
                                                        )}
                                                        title={code}
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          e.stopPropagation();
                                                          toggleGroupReaction(
                                                            msg,
                                                            code
                                                          );
                                                          document.body.click();
                                                        }}
                                                      >
                                                        {emoji}
                                                      </button>
                                                    )
                                                  )}
                                                  <button
                                                    type="button"
                                                    className="comm-react-plus"
                                                    title="More reactions"
                                                    onClick={(e) =>
                                                      openReactionEmojiPicker(
                                                        msg,
                                                        e
                                                      )
                                                    }
                                                  >
                                                    <i className="ri-add-line"></i>
                                                  </button>
                                                </div>
                                                <div className="comm-msg-menu-panel">
                                                  {messageActionItems
                                                    .filter((item) => {
                                                      if (item.id === "delete")
                                                        return true;
                                                      if (item.id === "info") {
                                                        return msg.from === "me";
                                                      }
                                                      if (
                                                        item.id === "download"
                                                      ) {
                                                        return (
                                                          (msg.type ===
                                                            "file" ||
                                                            msg.attachKind ||
                                                            msg.mediaSubtype) &&
                                                          Boolean(
                                                            getMessageAttachmentPath(
                                                              msg
                                                            )
                                                          )
                                                        );
                                                      }
                                                      return (
                                                        item.type !== "divider"
                                                      );
                                                    })
                                                    .map((item) => (
                                                      <React.Fragment
                                                        key={item.id}
                                                      >
                                                        {item.id ===
                                                        "delete" ? (
                                                          <div className="dropdown-divider" />
                                                        ) : null}
                                                        <DropdownItem
                                                          href="#"
                                                          className={
                                                            item.danger
                                                              ? "text-danger"
                                                              : ""
                                                          }
                                                          onClick={(e) => {
                                                            e.preventDefault();
                                                            handleGroupMessageAction(
                                                              item.id,
                                                              msg
                                                            );
                                                          }}
                                                        >
                                                          <i
                                                            className={`${item.icon} me-2 text-muted align-bottom`}
                                                          ></i>
                                                          {item.id ===
                                                            "star" &&
                                                          msg.starred
                                                            ? "Unstar"
                                                            : item.label}
                                                        </DropdownItem>
                                                      </React.Fragment>
                                                    ))}
                                                </div>
                                              </DropdownMenu>
                                            </UncontrolledDropdown>
                                            )}
                                          {msg.reaction ? (
                                            <button
                                              type="button"
                                              className="comm-msg-reaction"
                                              title="See who reacted"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setReactionDetailsMsg(msg);
                                              }}
                                            >
                                              {msg.reaction}
                                            </button>
                                          ) : null}
                                          </div>
                                          <div className="conversation-name">
                                            <small className="text-muted time">
                                              {msg.time}
                                            </small>
                                            {isMe ? (
                                              <span className="text-success check-message-icon">
                                                {renderGroupMessageTicks(msg)}
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </div>
                        </div>

                        <div
                          className={classnames(
                            "alert alert-warning alert-dismissible copyclipboard-alert px-4 fade",
                            { show: showCopyAlert }
                          )}
                          role="alert"
                        >
                          Message copied
                        </div>

                      {activeGroupTypingIds.length ? (
                        <div
                          className="comm-typing-indicator px-4 pb-1"
                          aria-label="typing"
                        >
                          <span className="comm-typing-dot" />
                          <span className="comm-typing-dot" />
                          <span className="comm-typing-dot" />
                        </div>
                      ) : null}

                      <div className="chat-input-section p-3 p-lg-4">
                        {replyTo ? (
                          <div className="replymessage-block mb-2 d-flex align-items-start">
                            <div className="flex-grow-1 overflow-hidden">
                              <h5 className="conversation-name mb-1">
                                {replyTo.from === "me"
                                  ? "You"
                                  : replyTo.sender || "Member"}
                              </h5>
                              <p className="mb-0 text-truncate">
                                {replyTo.type === "file"
                                  ? replyTo.fileName || "Attachment"
                                  : replyTo.text}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn btn-link p-0 text-muted"
                              onClick={() => setReplyTo(null)}
                            >
                              <i className="ri-close-fill align-middle"></i>
                            </button>
                          </div>
                        ) : null}
                        <form id="chatinput-form" onSubmit={sendMessage}>
                          <Row className="g-0 align-items-center">
                            <div className="col-auto">
                              <div className="chat-input-links me-2">
                                <div
                                  className="links-list-item position-relative"
                                  ref={emojiPickerRef}
                                >
                                  <button
                                    type="button"
                                    className="btn btn-link text-decoration-none emoji-btn"
                                    onClick={() => {
                                      setShowAttachMenu(false);
                                      setEmojiPicker((o) => !o);
                                    }}
                                  >
                                    <i className="bx bx-smile align-middle"></i>
                                  </button>
                                  {emojiPicker ? (
                                    <div className="comm-emoji-picker" role="dialog">
                                      <Picker
                                        onEmojiClick={onEmojiClick}
                                        searchDisabled
                                        skinTonesDisabled
                                        width={320}
                                        height={360}
                                        previewConfig={{ showPreview: false }}
                                      />
                                    </div>
                                  ) : null}
                                </div>
                                <div
                                  className="links-list-item position-relative"
                                  ref={attachMenuRef}
                                >
                                  <button
                                    type="button"
                                    className="btn btn-link text-decoration-none"
                                    title="Attach"
                                    disabled={sending}
                                    onClick={() => {
                                      setEmojiPicker(false);
                                      setShowAttachMenu((o) => !o);
                                    }}
                                  >
                                    <i className="ri-attachment-2 align-middle"></i>
                                  </button>
                                    {showAttachMenu ? (
                                      <div className="comm-attach-menu shadow" role="menu">
                                        {attachMenuItems.map((item) => (
                                          <button
                                            key={item.id}
                                            type="button"
                                            className="comm-attach-menu-item"
                                            role="menuitem"
                                            disabled={sending}
                                            onClick={() => openAttachPicker(item.id)}
                                          >
                                            <span
                                              className={classnames(
                                                "comm-attach-icon",
                                                item.color
                                              )}
                                            >
                                              <i className={item.icon}></i>
                                            </span>
                                            <span className="comm-attach-label">
                                              {item.label}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    ) : null}
                                    <input
                                      ref={attachFileInputRef}
                                      type="file"
                                      className="d-none"
                                      onChange={handleAttachFileChange}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="col">
                                <input
                                  ref={draftInputRef}
                                  type="text"
                                  value={curMessage}
                                  onKeyDown={onKeyPress}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setCurMessage(value);
                                    notifyGroupTyping(
                                      Boolean(String(value).trim())
                                    );
                                  }}
                                  className="form-control chat-input bg-light border-light"
                                  placeholder="Type your message..."
                                  disabled={sending}
                                />
                              </div>
                              <div className="col-auto">
                                <div className="chat-input-links ms-2">
                                  <div className="links-list-item">
                                    <Button
                                      type="submit"
                                      color="success"
                                      className="chat-send waves-effect waves-light"
                                      disabled={sending}
                                    >
                                      <i className="ri-send-plane-2-fill align-bottom"></i>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </Row>
                          </form>
                        </div>
                      </>
                    ) : (
                      <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted gap-2">
                        {groupsLoading ? "Loading groups..." : "No groups yet"}
                        {!groupsLoading ? (
                          <Button color="success" size="sm" onClick={openCreateModal}>
                            + Create group
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>

      <MessageReactionDetails
        isOpen={Boolean(reactionDetailsMsg?.id)}
        messageId={
          reactionDetailsMsg?.raw?.messageId ??
          reactionDetailsMsg?.raw?.MessageId ??
          reactionDetailsMsg?.id
        }
        message={reactionDetailsMsg}
        meUserId={me?.userId}
        peerUserId={
          reactionDetailsMsg?.senderUserId &&
          String(reactionDetailsMsg.senderUserId) !== String(me?.userId)
            ? reactionDetailsMsg.senderUserId
            : null
        }
        resolveUser={(userId) => {
          const id = String(userId);
          if (id === String(me?.userId ?? "")) {
            const self = mergedMembers.find((x) => x.isSelf);
            return {
              name: "You",
              email: me?.email || self?.email,
              avatarSrc:
                self?.avatarSrc ||
                resolveUserAvatarUrl(me?.userId, me?.profileImage),
            };
          }
          const m = mergedMembers.find((x) => String(x.userId) === id);
          if (m) {
            return {
              name: m.name,
              email: m.email,
              avatarSrc: m.avatarSrc,
            };
          }
          const profile = userById.get(id);
          if (profile) {
            return {
              name: profile.name || profile.email,
              email: profile.email,
              avatarSrc:
                profile.avatarSrc ||
                resolveUserAvatarUrl(userId, profile.profileImage),
            };
          }
          return {
            name: null,
            email: null,
            avatarSrc: resolveUserAvatarUrl(userId, null),
          };
        }}
        onClose={() => setReactionDetailsMsg(null)}
        onRemoveMine={(code) => {
          if (reactionDetailsMsg) {
            toggleGroupReaction(reactionDetailsMsg, code);
          }
          setReactionDetailsMsg(null);
        }}
      />

      {actionToast ? (
        <div className="alert alert-success comm-action-toast shadow" role="status">
          {actionToast}
        </div>
      ) : null}

      {/* Group info — WhatsApp-style structure (Media + Starred) */}
      <Offcanvas
        isOpen={infoOpen}
        direction="end"
        toggle={() => setInfoOpen(false)}
        backdrop={false}
        className="offcanvas-end border-0 comm-group-info"
        tabIndex="-1"
      >
        <OffcanvasBody className="p-0 d-flex flex-column">
          {infoView === "members" ? (
            <>
              <div className="comm-gi-header">
                <button
                  type="button"
                  className="btn btn-ghost-secondary btn-icon btn-sm"
                  onClick={() => {
                    setInfoView("main");
                    setMemberSearch("");
                    setMemberSearchOpen(false);
                  }}
                >
                  <i className="ri-arrow-left-line fs-18"></i>
                </button>
                <h5 className="comm-gi-title mb-0 flex-grow-1">
                  {mergedMembers.length} members
                </h5>
                <button
                  type="button"
                  className="btn btn-ghost-secondary btn-icon btn-sm"
                  onClick={() => setMemberSearchOpen((o) => !o)}
                >
                  <i className="ri-search-line fs-18"></i>
                </button>
              </div>

              {memberSearchOpen ? (
                <div className="px-3 pb-2">
                  <Input
                    type="text"
                    className="form-control form-control-sm bg-light border-light"
                    placeholder="Search members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              ) : null}

              <SimpleBar className="comm-gi-scroll flex-grow-1">
                {isCurrentAdmin ? (
                  <button
                    type="button"
                    className="comm-gi-action-row"
                    onClick={openAddMembers}
                  >
                    <span className="comm-gi-action-icon">
                      <i className="ri-user-add-line"></i>
                    </span>
                    <span className="comm-gi-action-label">Add member</span>
                  </button>
                ) : null}

                {filteredInfoMembers.map((m) => (
                  <div key={m.userId} className="comm-gi-member">
                    <img src={m.avatarSrc} alt="" className="comm-gi-member-avatar" />
                    <div className="comm-gi-member-body">
                      <div className="d-flex align-items-center gap-2">
                        <p className="comm-gi-member-name mb-0 text-truncate">
                          {m.isSelf ? "You" : m.name}
                        </p>
                        {m.isAdmin ? (
                          <span className="comm-gi-admin-badge">Group admin</span>
                        ) : null}
                      </div>
                      {renderMemberPresenceBadge(m)}
                      <small className="comm-gi-member-sub text-truncate d-block">
                        {m.email || m.phone || "—"}
                      </small>
                    </div>
                    {m.phone ? (
                      <span className="comm-gi-member-phone">{m.phone}</span>
                    ) : null}
                    {(() => {
                      const adminCount = mergedMembers.filter((x) => x.isAdmin).length;
                      const canDismissSelf =
                        m.isSelf && m.isAdmin && adminCount > 1;
                      const showOtherAdminMenu = isCurrentAdmin && !m.isSelf;
                      if (!showOtherAdminMenu && !canDismissSelf) return null;
                      return (
                      <UncontrolledDropdown className="comm-gi-member-actions">
                        <DropdownToggle
                          tag="button"
                          className="btn btn-ghost-secondary btn-icon btn-sm"
                          title="Member options"
                          disabled={busyAction === "remove" || busyAction === "admin"}
                        >
                          <i className="ri-more-2-fill"></i>
                        </DropdownToggle>
                        <DropdownMenu end>
                          {m.isSelf ? (
                            <DropdownItem
                              onClick={() => handleSetMemberAdmin(m.userId, false)}
                            >
                              <i className="ri-shield-user-line me-2"></i>
                              Dismiss as admin
                            </DropdownItem>
                          ) : m.isAdmin ? (
                            <DropdownItem
                              onClick={() => handleSetMemberAdmin(m.userId, false)}
                            >
                              <i className="ri-shield-user-line me-2"></i>
                              Dismiss as admin
                            </DropdownItem>
                          ) : (
                            <DropdownItem
                              onClick={() => handleSetMemberAdmin(m.userId, true)}
                            >
                              <i className="ri-shield-check-line me-2"></i>
                              Make group admin
                            </DropdownItem>
                          )}
                          {!m.isSelf ? (
                            <>
                              <DropdownItem divider />
                              <DropdownItem
                                className="text-danger"
                                onClick={() => handleRemoveMember(m.userId)}
                              >
                                <i className="ri-user-unfollow-line me-2"></i>
                                Remove member
                              </DropdownItem>
                            </>
                          ) : null}
                        </DropdownMenu>
                      </UncontrolledDropdown>
                      );
                    })()}
                  </div>
                ))}
                {!filteredInfoMembers.length && !detailsLoading ? (
                  <p className="text-muted fs-13 px-3 py-4 mb-0">No members found</p>
                ) : null}
              </SimpleBar>
            </>
          ) : infoView === "media" ? (
            <>
              <div className="comm-gi-header">
                <button
                  type="button"
                  className="btn btn-ghost-secondary btn-icon btn-sm"
                  onClick={() => setInfoView("main")}
                >
                  <i className="ri-arrow-left-line fs-18"></i>
                </button>
                <h5 className="comm-gi-title mb-0">Media, links and docs</h5>
              </div>
              <SimpleBar className="comm-gi-scroll flex-grow-1">
                {messagesLoading ? (
                  <p className="text-muted fs-13 px-3 py-4 mb-0">Loading...</p>
                ) : messagesError ? (
                  <div className="px-3 py-4">
                    <p className="text-danger fs-13 mb-2">
                      Unable to load media and links.
                    </p>
                    <button
                      type="button"
                      className="btn btn-soft-success btn-sm"
                      onClick={() =>
                        activeGroup?.chatId &&
                        loadGroupMessages(activeGroup.chatId)
                      }
                    >
                      Retry
                    </button>
                  </div>
                ) : groupSharedItems.length ? (
                  <div className="comm-gi-shared-list">
                    {groupMediaItems.length ? (
                      <>
                        <p className="comm-gi-shared-section px-3 mb-0 mt-2 text-muted text-uppercase fs-11 fw-semibold">
                          Media ({groupMediaItems.length})
                        </p>
                        {groupMediaItems.map((item) => (
                          <a
                            key={item.id}
                            href={item.url || "#"}
                            className="comm-gi-shared-item"
                            onClick={(e) => {
                              if (!item.url) e.preventDefault();
                            }}
                          >
                            <span className="comm-gi-shared-icon">
                              {item.mediaSubtype === "photo" && item.url ? (
                                <img src={item.url} alt="" />
                              ) : (
                                <i className={item.icon}></i>
                              )}
                            </span>
                            <span className="comm-gi-shared-body">
                              <span className="comm-gi-shared-name text-truncate">
                                {item.fileName}
                              </span>
                              <small className="text-muted">
                                {item.mediaSubtype === "video"
                                  ? "Video"
                                  : item.kind === "audio"
                                    ? "Audio"
                                    : "Photo"}
                                {item.time ? ` · ${item.time}` : ""}
                              </small>
                            </span>
                          </a>
                        ))}
                      </>
                    ) : null}

                    {groupLinkItems.length ? (
                      <>
                        <p className="comm-gi-shared-section px-3 mb-0 mt-2 text-muted text-uppercase fs-11 fw-semibold">
                          Links ({groupLinkItems.length})
                        </p>
                        {groupLinkItems.map((item) => (
                          <a
                            key={item.id}
                            href={item.url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="comm-gi-shared-item"
                          >
                            <span className="comm-gi-shared-icon">
                              <i className="ri-link"></i>
                            </span>
                            <span className="comm-gi-shared-body">
                              <span className="comm-gi-shared-name text-truncate">
                                {item.fileName}
                              </span>
                              <small className="text-muted">
                                Link{item.time ? ` · ${item.time}` : ""}
                              </small>
                            </span>
                          </a>
                        ))}
                      </>
                    ) : null}

                    {groupDocumentItems.length ? (
                      <>
                        <p className="comm-gi-shared-section px-3 mb-0 mt-2 text-muted text-uppercase fs-11 fw-semibold">
                          Documents ({groupDocumentItems.length})
                        </p>
                        {groupDocumentItems.map((item) => (
                          <a
                            key={item.id}
                            href={item.url || "#"}
                            className="comm-gi-shared-item"
                            onClick={(e) => {
                              if (!item.url) e.preventDefault();
                            }}
                          >
                            <span className="comm-gi-shared-icon">
                              <i className={item.icon}></i>
                            </span>
                            <span className="comm-gi-shared-body">
                              <span className="comm-gi-shared-name text-truncate">
                                {item.fileName}
                              </span>
                              <small className="text-muted">
                                Document{item.time ? ` · ${item.time}` : ""}
                              </small>
                            </span>
                          </a>
                        ))}
                      </>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-muted fs-13 px-3 py-4 mb-0">
                    No media, links or docs yet
                  </p>
                )}
              </SimpleBar>
            </>
          ) : infoView === "starred" ? (
            <>
              <div className="comm-gi-header">
                <button
                  type="button"
                  className="btn btn-ghost-secondary btn-icon btn-sm"
                  onClick={() => setInfoView("main")}
                >
                  <i className="ri-arrow-left-line fs-18"></i>
                </button>
                <h5 className="comm-gi-title mb-0">Starred messages</h5>
              </div>
              <SimpleBar className="comm-gi-scroll flex-grow-1">
                {groupStarredMessages.length ? (
                  <div className="comm-gi-shared-list">
                    {groupStarredMessages.map((msg) => (
                      <button
                        key={msg.id}
                        type="button"
                        className="comm-gi-shared-item text-start"
                        onClick={() => {
                          setInfoOpen(false);
                          const el = document.getElementById(
                            `group-msg-${msg.id}`
                          );
                          el?.scrollIntoView?.({
                            behavior: "smooth",
                            block: "center",
                          });
                        }}
                      >
                        <span className="comm-gi-shared-icon">
                          <i className="ri-star-fill text-warning"></i>
                        </span>
                        <span className="overflow-hidden flex-grow-1">
                          <span className="d-block text-truncate fw-medium">
                            {msg.type === "file"
                              ? msg.fileName || "Attachment"
                              : msg.text || "Message"}
                          </span>
                          <small className="text-muted">
                            {msg.from === "me" ? "You" : msg.sender}
                            {msg.time ? ` · ${msg.time}` : ""}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-4">
                    <p className="text-muted fs-13 mb-0">
                      No starred messages yet. Use Star on a message menu to
                      save it here (saved for you on this device).
                    </p>
                  </div>
                )}
              </SimpleBar>
            </>
          ) : (
            <>
              <div className="comm-gi-header">
                <button
                  type="button"
                  className="btn btn-ghost-secondary btn-icon btn-sm"
                  onClick={() => setInfoOpen(false)}
                >
                  <i className="ri-close-line fs-18"></i>
                </button>
                <h5 className="comm-gi-title mb-0">Group info</h5>
              </div>

              <SimpleBar className="comm-gi-scroll flex-grow-1">
                <div className="comm-gi-hero text-center">
                  <div className="comm-gi-avatar-wrap">
                    {activeGroup?.avatarSrc ? (
                      <img
                        src={activeGroup.avatarSrc}
                        alt=""
                        className="comm-gi-avatar-img"
                      />
                    ) : (
                      <div
                        className="comm-gi-avatar mx-auto"
                        style={{
                          backgroundColor:
                            activeGroup?.color || "var(--vz-success)",
                        }}
                      >
                        {activeGroup?.initials}
                      </div>
                    )}
                    {isCurrentAdmin ? (
                      <>
                        <input
                          ref={groupAvatarInputRef}
                          type="file"
                          accept="image/*"
                          className="comm-gi-avatar-edit-input"
                          onChange={handleGroupAvatarChange}
                          disabled={avatarSaving}
                        />
                        <button
                          type="button"
                          className="comm-gi-avatar-edit"
                          title="Change group photo"
                          disabled={avatarSaving}
                          onClick={() => groupAvatarInputRef.current?.click()}
                        >
                          <i
                            className={
                              avatarSaving
                                ? "ri-loader-4-line"
                                : "ri-camera-fill"
                            }
                          ></i>
                        </button>
                      </>
                    ) : null}
                  </div>
                  <div className="d-flex align-items-center justify-content-center gap-2 mt-3 px-3">
                    <h4 className="comm-gi-name mb-0 text-truncate">
                      {activeGroup?.name}
                    </h4>
                    {isCurrentAdmin ? (
                      <button
                        type="button"
                        className="btn btn-ghost-secondary btn-icon btn-sm"
                        title="Edit group"
                        onClick={openEditModal}
                      >
                        <i className="ri-pencil-line fs-16"></i>
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="comm-gi-member-count btn btn-link text-decoration-none p-0 mt-1"
                    onClick={() => setInfoView("members")}
                  >
                    Group ·{" "}
                    <span className="comm-gi-member-count-accent">
                      {mergedMembers.length || 0} members
                    </span>
                  </button>

                  <div className="comm-gi-quick-actions mt-3">
                    {isCurrentAdmin ? (
                      <button
                        type="button"
                        className="comm-gi-quick-btn"
                        onClick={openAddMembers}
                      >
                        <span className="comm-gi-quick-icon">
                          <i className="ri-user-add-line"></i>
                        </span>
                        <span>Add</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="comm-gi-quick-btn"
                      onClick={() => {
                        setInfoView("members");
                        setMemberSearchOpen(true);
                      }}
                    >
                      <span className="comm-gi-quick-icon">
                        <i className="ri-search-line"></i>
                      </span>
                      <span>Search</span>
                    </button>
                  </div>
                </div>

                <div className="comm-gi-card">
                  {detailsLoading ? (
                    <p className="text-muted mb-0 fs-13">Loading group...</p>
                  ) : detailsError ? (
                    <p className="text-danger mb-0 fs-13">{detailsError}</p>
                  ) : (
                    <p className="comm-gi-desc mb-0">
                      {activeGroup?.description || "No description"}
                    </p>
                  )}
                  {isCurrentAdmin ? (
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-success text-decoration-none px-0 mt-2"
                      onClick={openEditModal}
                    >
                      Edit description
                    </button>
                  ) : null}
                </div>

                <div className="comm-gi-media-block">
                  <button
                    type="button"
                    className="comm-gi-list-row"
                    onClick={openMediaView}
                  >
                    <i className="ri-image-line comm-gi-list-icon"></i>
                    <span className="flex-grow-1 text-start">
                      Media, links and docs
                    </span>
                    <span className="text-muted fs-13 me-1">
                      {groupSharedItems.length}
                    </span>
                    <i className="ri-arrow-right-s-line text-muted"></i>
                  </button>
                  {groupMediaThumbs.length ? (
                    <div className="comm-gi-media-row">
                      {groupMediaThumbs.slice(0, 4).map((item) => (
                        <button
                          key={`thumb-${item.id}`}
                          type="button"
                          className="comm-gi-media-thumb"
                          title={item.fileName}
                          onClick={openMediaView}
                        >
                          {item.mediaSubtype === "photo" && item.url ? (
                            <img src={item.url} alt="" />
                          ) : (
                            <span className="comm-gi-media-thumb-fallback">
                              <i
                                className={
                                  item.mediaSubtype === "video"
                                    ? "ri-video-fill"
                                    : item.icon
                                }
                              ></i>
                            </span>
                          )}
                          {item.mediaSubtype === "video" ? (
                            <span className="comm-gi-media-video-badge">
                              <i className="ri-play-fill"></i>
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="comm-gi-list-row"
                  onClick={openStarredView}
                >
                  <i className="ri-star-line comm-gi-list-icon"></i>
                  <span className="flex-grow-1 text-start">Starred messages</span>
                  <i className="ri-arrow-right-s-line text-muted"></i>
                </button>

                <button
                  type="button"
                  className="comm-gi-list-row"
                  onClick={() => setInfoView("members")}
                >
                  <i className="ri-group-line comm-gi-list-icon"></i>
                  <span className="flex-grow-1 text-start">
                    {mergedMembers.length} members
                  </span>
                  <i className="ri-arrow-right-s-line text-muted"></i>
                </button>

                <div className="comm-gi-members-preview">
                  {sortedMembers.slice(0, 5).map((m) => (
                    <div key={m.userId} className="comm-gi-member">
                      <img
                        src={m.avatarSrc}
                        alt=""
                        className="comm-gi-member-avatar"
                      />
                      <div className="comm-gi-member-body">
                        <div className="d-flex align-items-center gap-2">
                          <p className="comm-gi-member-name mb-0 text-truncate">
                            {m.isSelf ? "You" : m.name}
                          </p>
                          {m.isAdmin ? (
                            <span className="comm-gi-admin-badge">Group admin</span>
                          ) : null}
                        </div>
                        {renderMemberPresenceBadge(m)}
                        <small className="comm-gi-member-sub text-truncate d-block">
                          {m.email || "—"}
                        </small>
                      </div>
                    </div>
                  ))}
                  {sortedMembers.length > 5 ? (
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-success text-decoration-none px-3"
                      onClick={() => setInfoView("members")}
                    >
                      View all {sortedMembers.length} members
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="comm-gi-leave"
                  disabled={busyAction === "leave"}
                  onClick={handleLeaveGroup}
                >
                  <i className="ri-logout-box-r-line me-2"></i>
                  {busyAction === "leave" ? "Leaving group..." : "Leave group"}
                </button>
              </SimpleBar>
            </>
          )}
        </OffcanvasBody>
      </Offcanvas>

      {/* Create Group */}
      <Modal isOpen={createOpen} toggle={() => !creating && setCreateOpen(false)} centered>
        <ModalHeader toggle={() => !creating && setCreateOpen(false)}>
          Create Group
        </ModalHeader>
        <ModalBody>
          <FormGroup>
            <Label>Group Name</Label>
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Development Team"
              disabled={creating}
            />
          </FormGroup>
          <FormGroup>
            <Label>Description</Label>
            <Input
              type="textarea"
              rows={2}
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              disabled={creating}
            />
          </FormGroup>
          <FormGroup>
            <Label>Search users...</Label>
            <Input
              value={createUserSearch}
              onChange={(e) => setCreateUserSearch(e.target.value)}
              placeholder="Search users..."
              disabled={creating}
            />
          </FormGroup>
          <div className="mb-2 fs-13 text-muted">
            Selected Members: {createSelectedIds.length}
          </div>
          {usersLoading ? (
            <div className="text-muted fs-13">Loading users...</div>
          ) : usersError ? (
            <div className="text-danger fs-13">{usersError}</div>
          ) : (
            <SimpleBar style={{ maxHeight: 240 }}>
              {createSelectableUsers.map((u) => (
                <Label
                  key={u.userId}
                  className="d-flex align-items-center gap-2 mb-2"
                  check
                >
                  <Input
                    type="checkbox"
                    checked={createSelectedIds.includes(u.userId)}
                    onChange={() => toggleCreateUser(u.userId)}
                    disabled={creating}
                  />
                  <img src={u.avatarSrc} alt="" className="rounded-circle avatar-xs" />
                  <span className="flex-grow-1 overflow-hidden">
                    <span className="d-block text-truncate">{u.name}</span>
                    <small className="text-muted text-truncate d-block">{u.email}</small>
                  </span>
                </Label>
              ))}
            </SimpleBar>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="light" disabled={creating} onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button color="success" disabled={creating} onClick={handleCreateGroup}>
            {creating ? "Creating group..." : "Create"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Group */}
      <Modal isOpen={editOpen} toggle={() => !savingEdit && setEditOpen(false)} centered>
        <ModalHeader toggle={() => !savingEdit && setEditOpen(false)}>
          Edit Group
        </ModalHeader>
        <ModalBody>
          <FormGroup>
            <Label>Group Name</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={savingEdit}
            />
          </FormGroup>
          <FormGroup>
            <Label>Description</Label>
            <Input
              type="textarea"
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              disabled={savingEdit}
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="light" disabled={savingEdit} onClick={() => setEditOpen(false)}>
            Cancel
          </Button>
          <Button color="success" disabled={savingEdit} onClick={handleSaveEdit}>
            {savingEdit ? "Saving..." : "Save"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Add Members */}
      <Modal isOpen={addOpen} toggle={() => !addingMembers && setAddOpen(false)} centered>
        <ModalHeader toggle={() => !addingMembers && setAddOpen(false)}>
          Add Members
        </ModalHeader>
        <ModalBody>
          <FormGroup>
            <Input
              value={addUserSearch}
              onChange={(e) => setAddUserSearch(e.target.value)}
              placeholder="Search users..."
              disabled={addingMembers}
            />
          </FormGroup>
          <div className="mb-2 fs-13 text-muted">
            Selected: {addSelectedIds.length}
          </div>
          {usersLoading ? (
            <div className="text-muted fs-13">Loading users...</div>
          ) : (
            <SimpleBar style={{ maxHeight: 280 }}>
              {addSelectableUsers.map((u) => (
                <Label
                  key={u.userId}
                  className="d-flex align-items-center gap-2 mb-2"
                  check
                >
                  <Input
                    type="checkbox"
                    checked={addSelectedIds.includes(u.userId)}
                    onChange={() =>
                      setAddSelectedIds((prev) =>
                        prev.includes(u.userId)
                          ? prev.filter((id) => id !== u.userId)
                          : [...prev, u.userId]
                      )
                    }
                    disabled={addingMembers}
                  />
                  <img src={u.avatarSrc} alt="" className="rounded-circle avatar-xs" />
                  <span className="flex-grow-1 overflow-hidden">
                    <span className="d-block text-truncate">{u.name}</span>
                    <small className="text-muted text-truncate d-block">{u.email}</small>
                  </span>
                </Label>
              ))}
              {!addSelectableUsers.length ? (
                <p className="text-muted fs-13 mb-0">No users available to add.</p>
              ) : null}
            </SimpleBar>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="light" disabled={addingMembers} onClick={() => setAddOpen(false)}>
            Cancel
          </Button>
          <Button color="success" disabled={addingMembers} onClick={handleAddMembers}>
            {addingMembers ? "Adding members..." : "Add"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Message Info — WhatsApp-style Read by / Delivered to */}
      <MessageInfo
        message={messageInfoMsg}
        members={messageInfoMembers}
        onlineIds={messageInfoOnlineIds}
        loading={messageInfoLoading}
        loadError={messageInfoLoadError}
        onClose={closeMessageInfo}
      />

      {/* Forward message — same API as One-to-One */}
      <Modal
        isOpen={Boolean(forwardMessage)}
        toggle={closeForwardModal}
        centered
        scrollable
        className="comm-forward-modal"
      >
        <ModalHeader toggle={closeForwardModal}>Forward message to</ModalHeader>
        <ModalBody>
          <FormGroup>
            <Input
              type="search"
              placeholder="Search users or groups..."
              value={forwardSearch}
              disabled={forwarding}
              onChange={(e) => setForwardSearch(e.target.value)}
            />
          </FormGroup>
          {usersLoading ||
          (forwardGroupsLoading && !forwardCandidates.length) ? (
            <div className="text-muted fs-13">Loading...</div>
          ) : (
            <SimpleBar style={{ maxHeight: 320 }}>
              {forwardCandidates.map((item) => {
                const key = item.targetKey || String(item.userId || item.id);
                const selected = forwardSelectedIds.includes(String(key));
                const subtitle =
                  item.targetType === "group"
                    ? "Group"
                    : item.email || "—";
                return (
                  <button
                    key={key}
                    type="button"
                    className={classnames(
                      "comm-forward-list-item btn btn-link text-decoration-none text-body w-100 text-start mb-1 px-2 py-2 d-flex align-items-center gap-2 border-0 shadow-none",
                      { "is-selected": selected }
                    )}
                    disabled={forwarding}
                    onClick={() => toggleForwardTarget(key)}
                  >
                    <Input
                      type="checkbox"
                      checked={selected}
                      readOnly
                      className="mt-0"
                    />
                    <img
                      src={
                        item.targetType === "group"
                          ? item.avatarSrc || getCommAvatarSrc(item.groupId)
                          : item.avatarSrc
                      }
                      alt=""
                      className="rounded-circle avatar-xs"
                    />
                    <span className="flex-grow-1 overflow-hidden">
                      <span className="d-block text-truncate">
                        {item.name}
                        {item.targetType === "group" ? (
                          <span className="badge bg-soft-primary text-primary ms-2 fs-11">
                            Group
                          </span>
                        ) : null}
                      </span>
                      <small className="text-muted text-truncate d-block">
                        {subtitle}
                      </small>
                    </span>
                  </button>
                );
              })}
              {!forwardCandidates.length ? (
                <p className="text-muted fs-13 mb-0">No chats found.</p>
              ) : null}
            </SimpleBar>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={closeForwardModal} disabled={forwarding}>
            Cancel
          </Button>
          <Button
            color="success"
            disabled={forwarding || !forwardSelectedIds.length}
            onClick={confirmForwardMessages}
          >
            {forwarding ? "Forwarding..." : "Forward"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={Boolean(deleteDialog)}
        toggle={closeDeleteDialog}
        centered
        className="comm-delete-modal"
        contentClassName="comm-delete-modal-content"
      >
        <ModalBody className="comm-delete-modal-body text-center">
          <h5 className="comm-delete-title mb-4">
            {(deleteDialog?.messages?.length || 0) > 1
              ? `Delete ${deleteDialog.messages.length} messages?`
              : "Delete message?"}
          </h5>
          <div className="d-grid gap-2">
            {(deleteDialog?.messages || []).some((m) => m.from === "me") ? (
              <button
                type="button"
                className="comm-delete-btn comm-delete-everyone"
                disabled={deletingMessages}
                onClick={handleDeleteForEveryone}
              >
                {deletingMessages ? "Deleting..." : "Delete for everyone"}
              </button>
            ) : null}
            <button
              type="button"
              className="comm-delete-btn comm-delete-me"
              disabled={deletingMessages}
              onClick={handleDeleteForMe}
            >
              Delete for me
            </button>
            <button
              type="button"
              className="comm-delete-btn comm-delete-cancel"
              disabled={deletingMessages}
              onClick={closeDeleteDialog}
            >
              Cancel
            </button>
          </div>
        </ModalBody>
      </Modal>

      <Modal
        isOpen={leaveDialogOpen}
        toggle={closeLeaveDialog}
        centered
        className="comm-delete-modal"
        contentClassName="comm-delete-modal-content"
      >
        <ModalBody className="comm-delete-modal-body text-center">
          <h5 className="comm-delete-title mb-2">Leave group?</h5>
          <p className="text-muted fs-13 mb-4">
            {activeGroup?.name
              ? `Leave “${activeGroup.name}”? You won’t receive new messages until someone adds you again.`
              : "Are you sure you want to leave this group?"}
          </p>
          <div className="d-grid gap-2">
            <button
              type="button"
              className="comm-delete-btn comm-delete-everyone"
              disabled={busyAction === "leave"}
              onClick={confirmLeaveGroup}
            >
              {busyAction === "leave" ? "Leaving..." : "Leave group"}
            </button>
            <button
              type="button"
              className="comm-delete-btn comm-delete-cancel"
              disabled={busyAction === "leave"}
              onClick={closeLeaveDialog}
            >
              Cancel
            </button>
          </div>
        </ModalBody>
      </Modal>
    </React.Fragment>
  );
};

export default Groups;
