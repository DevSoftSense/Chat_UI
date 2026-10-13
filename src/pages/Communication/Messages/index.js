import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Container,
  Button,
  Input,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Row,
  Col,
  UncontrolledDropdown,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
  UncontrolledTooltip,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormGroup,
  Label,
} from "reactstrap";
import { Link } from "react-router-dom";
import SimpleBar from "simplebar-react";
import classnames from "classnames";
import FeatherIcon from "feather-icons-react";
import Picker from "emoji-picker-react";
import { useLocation, useNavigate } from "react-router-dom";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import { getCommAvatarSrc } from "../components/CommAvatar";
import PersonalInfo from "../../Chat/PersonalInfo";
import userDummyImage from "../../../assets/images/users/user-dummy-img.jpg";
import {
  messageActionItems,
  moreMenuItems,
  QUICK_REACTIONS,
  reactionCodeToEmoji,
  emojiToReactionCode,
  normalizeReactionCode,
  joinReactionEmojis,
  patchMessageReactions,
  readStoredReactions,
  writeStoredReactions,
  MessageReactionDetails,
} from "./MessageActions";
import {
  attachMenuItems,
  resolveAttachMeta,
  attachIconForMessage,
  attachmentIconForFileName,
  cleanAttachmentDisplayName,
  formatAttachMessageBody,
  attachKindToMessageTypeId,
  pickUploadedAttachmentPath,
  validateAttachFileKind,
  clearComposerDraft,
  dmDraftKey,
  getComposerDraft,
  setComposerDraft,
  ATTACH_DRAW_COLORS,
  composeDrawnImageFile,
} from "./MessageAttachments";
import {
  getConfiguredProductId,
  getOrganisationProductUsers,
  getSessionPublicOrgId,
  getSessionUserIdentity,
  formatProfilePhoneDisplay,
  getSoftOnCloudProfile,
  updateSoftOnCloudProfile,
  updateSoftOnCloudProfileImage,
  formatProfileApiError,
  getChatMessages,
  getOrCreatePrivateChat,
  sendChatMessage,
  forwardChatMessage,
  deleteChatMessage,
  getChatGroups,
  uploadChatAttachments,
  getChatAttachmentLimits,
  DEFAULT_CHAT_MAX_FILE_SIZE_MB,
  toggleChatMessageStar,
  toggleChatMessageReaction,
  clearChat,
  deleteChat,
  resolveChatAttachmentUrl,
  fetchChatAttachmentBlob,
  subscribeChatPresence,
  sendChatTyping,
  markChatMessagesRead,
  ackChatMessageDelivered,
  getChatUnreadCountsByPeer,
  resolveUserAvatarUrl,
  setMessagesUnreadTotal,
  sumChatListUnread,
  getChatDateFormat,
  formatDateByPreference,
} from "../../../helpers/softoncloud_auth_helper";
import {
  CHAT_TAB,
  useTabPermission,
} from "../../../contexts/ChatPermissionsContext";
import "./messages.scss";

const pickUserPhone = (user) => {
  return (
    formatProfilePhoneDisplay(
      user?.phoneCountryCode ||
        user?.phone_country_code ||
        user?.PhoneCountryCode ||
        "",
      user?.phone || user?.Phone || user?.phoneNumber || ""
    ) || ""
  );
};

const pickUserLocation = (user) => {
  const direct =
    user?.location ||
    user?.Location ||
    user?.city ||
    user?.City ||
    user?.address ||
    user?.Address ||
    null;
  if (direct) return String(direct).trim();
  const parts = [
    user?.city || user?.City,
    user?.state || user?.State || user?.region || user?.Region,
    user?.country || user?.Country || user?.countryName || user?.CountryName,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "";
};

const pickUserAvatar = (user) =>
  user?.profileImageUrl ||
  user?.ProfileImageUrl ||
  user?.profile_image_url ||
  user?.avatarUrl ||
  user?.AvatarUrl ||
  user?.profileImage ||
  user?.ProfileImage ||
  user?.photoUrl ||
  user?.PhotoUrl ||
  user?.imageUrl ||
  user?.ImageUrl ||
  null;

const pickUserRoles = (user) => {
  const roles =
    user?.roleNames ||
    user?.RoleNames ||
    user?.roles ||
    user?.Roles ||
    [];
  return Array.isArray(roles) ? roles.filter(Boolean).map(String) : [];
};

const pickAccountActive = (user) => {
  if (typeof user?.isActive === "boolean") return user.isActive;
  if (typeof user?.IsActive === "boolean") return user.IsActive;
  if (typeof user?.active === "boolean") return user.active;
  return true;
};

const toggleCustomTab = (current, tab, setter) => {
  if (current !== tab) setter(tab);
};

const MSG_STATUS = {
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
};

const STATUS_RANK = {
  [MSG_STATUS.SENT]: 1,
  [MSG_STATUS.DELIVERED]: 2,
  [MSG_STATUS.READ]: 3,
};

const maxMessageStatus = (current, next) => {
  const a = STATUS_RANK[current] || 0;
  const b = STATUS_RANK[next] || 0;
  return b > a ? next : current || MSG_STATUS.SENT;
};

const resolveOutgoingStatus = (msg, peerOnline) => {
  if (!msg || msg.from !== "me") return null;
  if (msg.status === MSG_STATUS.READ || msg.read) return MSG_STATUS.READ;
  if (msg.status === MSG_STATUS.DELIVERED) return MSG_STATUS.DELIVERED;
  if (peerOnline) return MSG_STATUS.DELIVERED;
  return MSG_STATUS.SENT;
};

const CHAT_UI_STORAGE_KEY = "chatUiState";
const DOWNLOADED_ATTACHMENTS_KEY = "chatDownloadedAttachments";
const DELETED_FOR_ME_KEY = "chatDeletedForMe";

const readChatUiState = () => {
  try {
    return JSON.parse(sessionStorage.getItem(CHAT_UI_STORAGE_KEY) || "null") || {};
  } catch {
    return {};
  }
};

const writeChatUiState = (patch) => {
  try {
    const next = { ...readChatUiState(), ...patch };
    sessionStorage.setItem(CHAT_UI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
};

const readDownloadedAttachments = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(DOWNLOADED_ATTACHMENTS_KEY) || "[]");
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
    // ignore quota / private mode
  }
};

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
    // ignore quota / private mode
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

const formatMessageTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/** WhatsApp-style day label: Today / Yesterday / Settings date format */
const formatChatDayLabel = (value, dateFormat = getChatDateFormat()) => {
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

const getMessageDayKey = (msg) => {
  const raw = msg?.sentAt || msg?.raw?.sentAt || msg?.raw?.SentAt || msg?.raw?.createdAt;
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

/** Insert date separator rows between messages (WhatsApp-style). */
const withDateSeparators = (list, dateFormat = getChatDateFormat()) => {
  const rows = [];
  let lastKey = "";
  (list || []).forEach((msg) => {
    const key = getMessageDayKey(msg);
    if (key && key !== lastKey) {
      rows.push({
        id: `day-${key}`,
        isDateSeparator: true,
        label: formatChatDayLabel(
          msg.sentAt || msg?.raw?.sentAt || msg?.raw?.SentAt,
          dateFormat
        ),
      });
      lastKey = key;
    }
    rows.push(msg);
  });
  return rows;
};

const mapApiMessageToUi = (msg, myUserId, peerOnline = false) => {
  const senderId = msg?.senderUserId ?? msg?.SenderUserId;
  const sentAt = msg?.sentAt ?? msg?.SentAt ?? msg?.createdAt ?? msg?.CreatedAt;
  const from = String(senderId) === String(myUserId) ? "me" : "them";
  const read = Boolean(msg?.readAt ?? msg?.ReadAt);
  let status = MSG_STATUS.SENT;
  if (from === "me") {
    if (read) status = MSG_STATUS.READ;
    else if (peerOnline) status = MSG_STATUS.DELIVERED;
  }
  const starredBySender = Boolean(
    msg?.isStarredBySender ?? msg?.IsStarredBySender
  );
  const starredByReceiver = Boolean(
    msg?.isStarredByReceiver ?? msg?.IsStarredByReceiver
  );
  const isStarredByMeRaw =
    msg?.isStarredByMe ?? msg?.IsStarredByMe;
  const starred =
    isStarredByMeRaw === undefined || isStarredByMeRaw === null
      ? from === "me"
        ? starredBySender
        : starredByReceiver
      : Boolean(isStarredByMeRaw);
  const body = msg?.messageBody ?? msg?.MessageBody ?? "";
  const path1 =
    msg?.attachmentPath1 ??
    msg?.AttachmentPath1 ??
    null;
  const attach = resolveAttachMeta(
    body,
    msg?.typeName ?? msg?.TypeName
  );
  const fileNameFromPath = path1
    ? String(path1).split("/").pop()
    : null;
  const isFile = Boolean(attach || path1);
  const forwardedFrom =
    msg?.forwardedFromMessageId ??
    msg?.ForwardedFromMessageId ??
    null;
  const parentMessageIdRaw =
    msg?.parentMessageId ?? msg?.ParentMessageId ?? null;
  const parentMessageIdNum = Number(parentMessageIdRaw);
  const parentMessageId =
    Number.isFinite(parentMessageIdNum) && parentMessageIdNum > 0
      ? parentMessageIdNum
      : null;
  const replyPreview =
    msg?.replyTo && typeof msg.replyTo === "object"
      ? {
          id: msg.replyTo.id != null ? String(msg.replyTo.id) : null,
          name: msg.replyTo.name || msg.replyTo.Name || "",
          text: msg.replyTo.text || msg.replyTo.Text || "",
          from: msg.replyTo.from || null,
        }
      : null;
  const messageId = String(
    msg?.messageId ?? msg?.MessageId ?? `msg-${sentAt}-${senderId}`
  );
  const apiReactionCode =
    msg?.myReactionCode ??
    msg?.MyReactionCode ??
    msg?.reactionCode ??
    msg?.ReactionCode ??
    null;
  const apiReactionEmoji =
    msg?.myReaction ??
    msg?.MyReaction ??
    msg?.reaction ??
    msg?.Reaction ??
    null;
  const apiPeerReactionCode =
    msg?.peerReactionCode ??
    msg?.PeerReactionCode ??
    null;
  const apiPeerReactionEmoji =
    msg?.peerReaction ??
    msg?.PeerReaction ??
    null;
  const stored = readStoredReactions()[messageId] || null;
  const storedCode =
    typeof stored === "string"
      ? emojiToReactionCode(stored)
      : stored?.code || null;
  const storedEmoji =
    typeof stored === "string"
      ? stored
      : stored?.emoji || null;
  const reactionCode = apiReactionCode || storedCode || null;
  const myReactionEmoji =
    apiReactionEmoji ||
    storedEmoji ||
    (reactionCode ? reactionCodeToEmoji(reactionCode) : null) ||
    null;
  const peerReactionCode = apiPeerReactionCode || null;
  const peerReaction =
    apiPeerReactionEmoji ||
    (peerReactionCode ? reactionCodeToEmoji(peerReactionCode) : null) ||
    null;
  const reaction = joinReactionEmojis(myReactionEmoji, peerReaction);
  return {
    id: messageId,
    from,
    text: attach?.text || body || fileNameFromPath || "",
    time: formatMessageTime(sentAt),
    sentAt: sentAt || null,
    read,
    status,
    starred,
    starredAt:
      msg?.starredAt ??
      msg?.StarredAt ??
      (from === "me"
        ? msg?.starredBySenderAt ?? msg?.StarredBySenderAt
        : msg?.starredByReceiverAt ?? msg?.StarredByReceiverAt) ??
      null,
    peerUserId:
      msg?.peerUserId ??
      msg?.PeerUserId ??
      (from === "me"
        ? msg?.receiverUserId ?? msg?.ReceiverUserId
        : senderId) ??
      null,
    type: isFile ? "file" : "text",
    attachKind: attach?.attachKind || (path1 ? "document" : null),
    mediaSubtype: attach?.mediaSubtype || null,
    fileName: attach?.fileName || fileNameFromPath || null,
    caption: attach?.caption || null,
    attachmentPath1: path1,
    parentMessageId,
    replyTo: replyPreview,
    forwarded: Boolean(forwardedFrom),
    forwardedFromMessageId: forwardedFrom,
    reaction,
    reactionCode,
    peerReaction,
    peerReactionCode,
    raw: msg,
  };
};

/** Build UI reply quote from a selected message. */
const buildReplyPreview = (msg, peerName = "") => {
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
    name: msg.from === "me" ? "You" : peerName || "Contact",
    text: String(text).trim(),
    from: msg.from || null,
  };
};

/** Resolve reply quotes from parentMessageId against the same thread. */
const attachReplyPreviews = (list, peerName = "") => {
  if (!Array.isArray(list) || !list.length) return list || [];
  const byId = new Map(list.map((m) => [String(m.id), m]));
  return list.map((msg) => {
    const parentId =
      msg?.parentMessageId ||
      (msg?.replyTo?.id != null ? Number(msg.replyTo.id) : null);
    const parent = parentId ? byId.get(String(parentId)) : null;

    if (parent) {
      const preview = buildReplyPreview(parent, peerName);
      return {
        ...msg,
        parentMessageId: parentId || msg.parentMessageId || null,
        replyTo: {
          ...preview,
          // Keep any existing display text, but always pin the real parent id.
          text: msg.replyTo?.text || preview.text,
          name: msg.replyTo?.name || preview.name,
          id: String(parent.id),
        },
      };
    }

    if (msg?.replyTo && !msg.replyTo.id && parentId) {
      return {
        ...msg,
        replyTo: { ...msg.replyTo, id: String(parentId) },
      };
    }

    return msg;
  });
};

const isSameUser = (user, me) => {
  if (!user || !me) return false;
  if (me.userId && user.userId != null && String(user.userId) === String(me.userId)) {
    return true;
  }
  if (me.email && String(user.email || "").trim().toLowerCase() === me.email) {
    return true;
  }
  return false;
};

const mapApiUserToChat = (user, me = null) => {
  const self = isSameUser(user, me);
  const roles = pickUserRoles(user);
  const realName =
    user.displayName ||
    user.DisplayName ||
    [user.firstName || user.FirstName, user.middleName || user.MiddleName, user.lastName || user.LastName]
      .filter(Boolean)
      .join(" ") ||
    user.email ||
    user.Email ||
    `User ${user.userId || user.UserId}`;
  const apiAvatar = pickUserAvatar(user);
  const avatarSrc = resolveUserAvatarUrl(
    user.userId || user.UserId,
    apiAvatar
  );

  return {
    id: String(user.userId || user.UserId),
    publicUserId: user.publicUserId || user.PublicUserId,
    name: self ? "You" : realName,
    realName,
    isSelf: self,
    role: self
      ? "Message yourself"
      : user.jobTitle ||
        user.JobTitle ||
        roles[0] ||
        user.userType ||
        user.UserType ||
        "User",
    roles,
    // Account active from Product Users API — NOT SignalR online/offline
    accountActive: pickAccountActive(user),
    phone: pickUserPhone(user) || "—",
    email: user.email || user.Email || "—",
    location: pickUserLocation(user) || "—",
    department: user.department || user.Department || "—",
    jobTitle: user.jobTitle || user.JobTitle || "",
    avatarSrc,
    preview: self ? "Message yourself" : "Start a conversation",
    time: "",
    unread: 0,
    // Online/Offline comes only from SignalR presence (resolvePresenceStatus)
    starred: false,
    type: "direct",
  };
};

const buildSelfChatFromSession = (me) => {
  if (!me?.userId && !me?.email) return null;
  const avatarSrc = resolveUserAvatarUrl(me.userId, me.profileImage);
  const phone =
    formatProfilePhoneDisplay(me.phoneCountryCode, me.phone) ||
    me.phone ||
    "—";
  return {
    id: String(me.userId || `self-${me.email}`),
    publicUserId: null,
    name: "You",
    realName: me.displayName || me.email || "You",
    isSelf: true,
    role: "Message yourself",
    roles: [],
    accountActive: true,
    phone: phone || "—",
    email: me.email || "—",
    location: me.location || "—",
    department: me.department || "—",
    jobTitle: me.jobTitle || "",
    avatarSrc,
    preview: "Message yourself",
    time: "",
    unread: 0,
    // Online/Offline comes only from SignalR presence (resolvePresenceStatus)
    starred: false,
    type: "direct",
  };
};

const applyProfileToSelfChat = (chat, profile) => {
  if (!chat?.isSelf || !profile) return chat;
  const phone =
    formatProfilePhoneDisplay(profile.phoneCountryCode, profile.phone) ||
    profile.phone ||
    chat.phone;
  const avatarSrc = resolveUserAvatarUrl(
    profile.userId || chat.id,
    profile.profileImageUrl || chat.avatarSrc
  );
  return {
    ...chat,
    realName: profile.displayName || chat.realName,
    phone: phone || chat.phone || "—",
    email: profile.email || chat.email || "—",
    location: profile.location || chat.location || "—",
    department: profile.department || chat.department || "—",
    jobTitle: profile.jobTitle || chat.jobTitle || "",
    avatarSrc: avatarSrc || chat.avatarSrc,
  };
};

const Messages = () => {
  document.title = "Messages | Chat Module | SoftOnCloud";
  const { canAdd, canEdit, canDelete } = useTabPermission(CHAT_TAB.MESSAGES);

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [chatList, setChatList] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [draft, setDraft] = useState("");
  const [muteNotifications, setMuteNotifications] = useState(false);
  const [threads, setThreads] = useState({});
  const [conversationChatIds, setConversationChatIds] = useState(() => {
    const saved = readChatUiState().conversationChatIds;
    return saved && typeof saved === "object" ? saved : {};
  });
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [dateFormat, setDateFormat] = useState(() => getChatDateFormat());
  const [sending, setSending] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [actionToast, setActionToast] = useState("");
  /** userId strings currently Online via SignalR presence (in-memory hub). */
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  /** peer userId → typing (WhatsApp-style) */
  const [typingPeerIds, setTypingPeerIds] = useState(() => new Set());
  const typingClearTimersRef = useRef({});
  const lastTypingSentRef = useRef(0);
  const [hubConnected, setHubConnected] = useState(false);
  const [focusMessageId, setFocusMessageId] = useState(null);
  const [msgMenu, setMsgMenu] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const chatSearchInputRef = useRef(null);
  const loadSeqRef = useRef(0);
  const conversationChatIdsRef = useRef(conversationChatIds);
  const activeChatIdRef = useRef(activeChatId);
  const onlineUserIdsRef = useRef(onlineUserIds);
  const selectedChatIdRef = useRef(selectedChatId);
  const markReadInFlightRef = useRef(new Set());
  const msgMenuRef = useRef(null);
  const draftInputRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const attachMenuRef = useRef(null);
  const moreMenuRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const attachFileInputRef = useRef(null);
  const pendingAttachKindRef = useRef(null);
  const userChatShow = useRef(null);
  const [messageBox, setMessageBox] = useState(null);
  const [customActiveTab, setCustomActiveTab] = useState("1");
  const [search_Menu, setsearch_Menu] = useState(false);
  const [settings_Menu, setsettings_Menu] = useState(false);
  const [emojiPicker, setemojiPicker] = useState(false);
  /** Message for the “+” reaction emoji picker (only 6 allowed reactions save) */
  const [reactionPickerMsg, setReactionPickerMsg] = useState(null);
  const [reactionDetailsMsg, setReactionDetailsMsg] = useState(null);
  const [showCopyAlert, setShowCopyAlert] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [forwardSelectedIds, setForwardSelectedIds] = useState([]);
  const [forwardSearch, setForwardSearch] = useState("");
  const [forwarding, setForwarding] = useState(false);
  const [forwardGroups, setForwardGroups] = useState([]);
  const [forwardGroupsLoading, setForwardGroupsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** WhatsApp-style: file chosen but not sent until caption + Send. */
  const [pendingAttach, setPendingAttach] = useState(null); // { file, kind, previewUrl }
  const [attachCaption, setAttachCaption] = useState("");
  const attachCaptionRef = useRef(null);
  /** WhatsApp-style pencil draw on photo before send */
  const [imageDrawMode, setImageDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState(ATTACH_DRAW_COLORS[2]);
  const [drawStrokes, setDrawStrokes] = useState([]);
  const drawCanvasRef = useRef(null);
  const previewImgRef = useRef(null);
  const drawingStrokeRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(DEFAULT_CHAT_MAX_FILE_SIZE_MB);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [selfProfileLoading, setSelfProfileLoading] = useState(false);
  const [downloadedAttachments, setDownloadedAttachments] = useState(
    () => new Set(readDownloadedAttachments())
  );
  const [downloadingAttachments, setDownloadingAttachments] = useState(
    () => new Set()
  );
  const [deleteDialog, setDeleteDialog] = useState(null); // { messages: [] }
  const [deletingMessages, setDeletingMessages] = useState(false);
  /** Prevents duplicate Clear/Delete chat clicks while API is in flight */
  const [chatListActionBusy, setChatListActionBusy] = useState(false);
  const [deletedForMeIds, setDeletedForMeIds] = useState(() => new Set());
  const stickToBottomRef = useRef(true);

  const me = useMemo(() => getSessionUserIdentity(), []);

  // Keep sidebar Messages badge in sync with chat-list green unread totals.
  useEffect(() => {
    if (usersLoading) return;
    setMessagesUnreadTotal(sumChatListUnread(chatList));
  }, [chatList, usersLoading]);

  useEffect(() => {
    setDeletedForMeIds(new Set(readDeletedForMeIds(me?.userId)));
  }, [me?.userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const limits = await getChatAttachmentLimits();
        if (!cancelled && limits?.maxFileSizeMB > 0) {
          setMaxFileSizeMB(limits.maxFileSizeMB);
        }
      } catch {
        if (!cancelled) {
          setMaxFileSizeMB(DEFAULT_CHAT_MAX_FILE_SIZE_MB);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeChat =
    chatList.find((c) => String(c.id) === String(activeChatId)) || null;

  // Restore / persist composer draft per direct chat (left without sending).
  useEffect(() => {
    if (!activeChatId) {
      setDraft("");
      return;
    }
    setDraft(getComposerDraft(dmDraftKey(activeChatId)));
  }, [activeChatId]);

  useEffect(() => {
    if (!activeChatId) return undefined;
    const key = dmDraftKey(activeChatId);
    const timer = window.setTimeout(() => {
      setComposerDraft(key, draft, {
        type: "dm",
        name: activeChat?.name || activeChat?.fullName || "",
        photo: activeChat?.photo || activeChat?.avatar || null,
        href: "/communication/messages",
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft, activeChatId, activeChat?.name, activeChat?.fullName, activeChat?.photo, activeChat?.avatar]);

  const resolvePresenceStatus = (chat) => {
    if (!chat) return "offline";
    // Logged-in user on Messages is online — Velzon hardcodes `.online` for self.
    // Do not wait on SignalR or You stays grey until refresh / hub connect.
    if (chat.isSelf) return "online";
    return onlineUserIds.has(String(chat.id)) ? "online" : "offline";
  };

  const activePresenceStatus = resolvePresenceStatus(activeChat);
  const peerIsTyping =
    Boolean(activeChat) &&
    !activeChat.isSelf &&
    typingPeerIds.has(String(activeChat.id));

  const notifyPeerTyping = useCallback(
    (isTyping) => {
      if (!activeChat || activeChat.isSelf) return;
      const peerId = Number(activeChat.id);
      if (!Number.isFinite(peerId) || peerId <= 0) return;
      const now = Date.now();
      if (isTyping) {
        if (now - lastTypingSentRef.current < 1500) return;
        lastTypingSentRef.current = now;
      } else {
        lastTypingSentRef.current = 0;
      }
      sendChatTyping(peerId, isTyping);
    },
    [activeChat]
  );

  useEffect(() => {
    return () => {
      if (!activeChatId) return;
      sendChatTyping(Number(activeChatId), false);
    };
  }, [activeChatId]);

  const upgradeThreadStatuses = (peerUserId, predicate, nextStatus) => {
    const key = String(peerUserId);
    setThreads((prev) => {
      const list = prev[key];
      if (!list?.length) return prev;
      let changed = false;
      const next = list.map((msg) => {
        if (msg.from !== "me") return msg;
        if (predicate && !predicate(msg)) return msg;
        const status = maxMessageStatus(msg.status, nextStatus);
        if (status === msg.status && (nextStatus !== MSG_STATUS.READ || msg.read)) {
          return msg;
        }
        changed = true;
        return {
          ...msg,
          status,
          read: nextStatus === MSG_STATUS.READ ? true : msg.read,
        };
      });
      return changed ? { ...prev, [key]: next } : prev;
    });
  };

  const markActiveChatRead = async (chatId, peerUserId) => {
    const id = Number(chatId);
    if (!Number.isFinite(id) || id <= 0) return;
    const key = String(id);
    if (markReadInFlightRef.current.has(key)) return;
    markReadInFlightRef.current.add(key);
    try {
      await markChatMessagesRead(id);
      // Sender ticks update via MessagesRead hub event; local inbound already viewed.
      if (peerUserId) {
        setThreads((prev) => {
          const threadKey = String(peerUserId);
          const list = prev[threadKey];
          if (!list?.length) return prev;
          let changed = false;
          const next = list.map((msg) => {
            if (msg.from !== "them" || msg.read) return msg;
            changed = true;
            return { ...msg, read: true };
          });
          return changed ? { ...prev, [threadKey]: next } : prev;
        });
      }
    } catch {
      // Keep UI usable if mark-read fails (DB function may not be applied yet).
    } finally {
      markReadInFlightRef.current.delete(key);
    }
  };

  useEffect(() => {
    conversationChatIdsRef.current = conversationChatIds;
    writeChatUiState({ conversationChatIds });
  }, [conversationChatIds]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // When user returns to this tab with a chat open, clear green badge + mark read.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) return;
      const peer = activeChatIdRef.current;
      const chatId = selectedChatIdRef.current;
      if (!peer) return;
      setChatList((prev) =>
        prev.map((chat) =>
          String(chat.id) === String(peer) ? { ...chat, unread: 0 } : chat
        )
      );
      if (chatId) {
        markActiveChatRead(chatId, peer);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    onlineUserIdsRef.current = onlineUserIds;
  }, [onlineUserIds]);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  // Single shared SignalR hub → presence + live ReceiveMessage (no polling)
  useEffect(() => {
    const myUserId = me.userId;

    const unsubscribe = subscribeChatPresence((event, payload) => {
      if (event === "OnlineUsers") {
        const ids = Array.isArray(payload)
          ? payload.map((id) => String(id))
          : [];
        setOnlineUserIds(new Set(ids));
        setHubConnected(true);
        // Peer online ⇒ upgrade sent → delivered (never read)
        ids.forEach((peerId) => {
          upgradeThreadStatuses(peerId, null, MSG_STATUS.DELIVERED);
        });
        return;
      }
      if (event === "UserOnline") {
        const id = String(payload);
        setHubConnected(true);
        setOnlineUserIds((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        upgradeThreadStatuses(id, null, MSG_STATUS.DELIVERED);
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
        setTypingPeerIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        // Do not downgrade delivered/read ticks when peer goes offline.
        return;
      }
      if (event === "UserTyping") {
        const fromId = String(payload?.userId ?? payload?.UserId ?? "");
        if (!fromId || String(fromId) === String(myUserId)) return;
        const isTyping = Boolean(
          payload?.isTyping ?? payload?.IsTyping ?? true
        );
        const timers = typingClearTimersRef.current;
        if (timers[fromId]) {
          window.clearTimeout(timers[fromId]);
          delete timers[fromId];
        }
        if (isTyping) {
          setTypingPeerIds((prev) => {
            if (prev.has(fromId)) return prev;
            const next = new Set(prev);
            next.add(fromId);
            return next;
          });
          timers[fromId] = window.setTimeout(() => {
            setTypingPeerIds((prev) => {
              if (!prev.has(fromId)) return prev;
              const next = new Set(prev);
              next.delete(fromId);
              return next;
            });
            delete timers[fromId];
          }, 3000);
        } else {
          setTypingPeerIds((prev) => {
            if (!prev.has(fromId)) return prev;
            const next = new Set(prev);
            next.delete(fromId);
            return next;
          });
        }
        return;
      }
      if (event === "ConnectionState") {
        setHubConnected(payload === "connected");
        return;
      }
      if (event === "MessageDelivered") {
        if (!payload || myUserId == null) return;
        const messageId = String(
          payload.messageId ?? payload.MessageId ?? ""
        );
        const receiverId = String(
          payload.receiverUserId ?? payload.ReceiverUserId ?? ""
        );
        if (!messageId || !receiverId) return;
        upgradeThreadStatuses(
          receiverId,
          (msg) => String(msg.id) === messageId,
          MSG_STATUS.DELIVERED
        );
        return;
      }
      if (event === "MessagesRead") {
        if (!payload || myUserId == null) return;
        const readerId = String(
          payload.readerUserId ?? payload.ReaderUserId ?? ""
        );
        const messageIds = (
          payload.messageIds ??
          payload.MessageIds ??
          []
        ).map((id) => String(id));
        if (!readerId || readerId === String(myUserId)) return;
        if (messageIds.length) {
          upgradeThreadStatuses(
            readerId,
            (msg) => messageIds.includes(String(msg.id)),
            MSG_STATUS.READ
          );
        } else {
          upgradeThreadStatuses(readerId, null, MSG_STATUS.READ);
        }
        return;
      }
      if (event === "MessageDeleted") {
        const messageId = String(
          payload?.messageId ?? payload?.MessageId ?? ""
        );
        if (!messageId) return;
        setThreads((prev) => {
          let changed = false;
          const next = { ...prev };
          Object.keys(next).forEach((key) => {
            const list = next[key] || [];
            const filtered = list.filter((m) => String(m.id) !== messageId);
            if (filtered.length !== list.length) {
              next[key] = filtered;
              changed = true;
            }
          });
          return changed ? next : prev;
        });
        return;
      }
      if (event === "MessageReaction") {
        if (!payload || myUserId == null) return;
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
        const isMine = reactorId === String(myUserId);
        const senderOfMessage = String(
          payload.senderUserId ?? payload.SenderUserId ?? ""
        );
        // Someone reacted to my message → live toast (SignalR).
        if (
          !isMine &&
          reactionCode &&
          senderOfMessage &&
          senderOfMessage === String(myUserId)
        ) {
          const label = reactionEmoji || "👍";
          setActionToast(`${label} reacted to your message`);
          window.clearTimeout(showToast._timer);
          showToast._timer = window.setTimeout(() => setActionToast(""), 2500);
        }

        setThreads((prev) => {
          let changed = false;
          const next = { ...prev };
          Object.keys(next).forEach((key) => {
            const list = next[key] || [];
            const mapped = list.map((m) => {
              if (String(m.id) !== messageId) return m;
              changed = true;
              if (isMine) {
                return patchMessageReactions(m, {
                  reactionCode,
                  myEmoji: reactionEmoji,
                });
              }
              return patchMessageReactions(m, {
                peerReactionCode: reactionCode,
                peerReaction: reactionEmoji,
              });
            });
            if (changed) next[key] = mapped;
          });
          return changed ? next : prev;
        });
        return;
      }
      if (event === "ChatCleared" || event === "ChatDeleted") {
        if (!payload || myUserId == null) return;
        const chatId = Number(payload.chatId ?? payload.ChatId);
        const peerUserId = String(
          payload.peerUserId ?? payload.PeerUserId ?? ""
        );
        const actorId = String(
          payload.clearedBy ??
            payload.ClearedBy ??
            payload.deletedBy ??
            payload.DeletedBy ??
            ""
        );
        // Ignore events we initiated (local UI already updated).
        if (actorId && actorId === String(myUserId)) return;

        let threadKey = null;
        if (peerUserId && peerUserId !== String(myUserId)) {
          threadKey = peerUserId;
        } else if (Number.isFinite(chatId) && chatId > 0) {
          const map = conversationChatIdsRef.current || {};
          threadKey =
            Object.keys(map).find((key) => Number(map[key]) === chatId) || null;
        }
        if (!threadKey) return;

        setThreads((prev) => ({ ...prev, [threadKey]: [] }));
        if (event === "ChatDeleted") {
          // Peer soft-deleted chat on their side — only clear our message list for that chatId mapping.
          // Do not remove peer from contacts list (they remain available).
        }
        return;
      }
      if (event === "ReceiveMessage") {
        if (!payload || myUserId == null) return;

        // Groups fan-out on user hub — Messages module ignores those.
        const groupId = payload.groupId ?? payload.GroupId;
        if (groupId != null && groupId !== "") return;

        const senderId = String(
          payload.senderUserId ?? payload.SenderUserId ?? ""
        );
        const receiverId = String(
          payload.receiverUserId ?? payload.ReceiverUserId ?? ""
        );
        const myId = String(myUserId);

        // Only handle messages for this logged-in user
        let peerUserId = null;
        if (senderId === myId) peerUserId = receiverId;
        else if (receiverId === myId) peerUserId = senderId;
        else return;

        if (!peerUserId || peerUserId === "null" || peerUserId === "undefined") {
          return;
        }

        const peerOnline = onlineUserIdsRef.current.has(String(peerUserId));
        const uiMsg = mapApiMessageToUi(payload, myUserId, peerOnline);
        const chatIsOpen =
          String(activeChatIdRef.current) === String(peerUserId);
        const tabVisible =
          typeof document === "undefined" ? true : !document.hidden;
        // Count as unread unless this chat is open AND the tab is visible (WhatsApp-like).
        const viewingThisChat = chatIsOpen && tabVisible;
        const isFromMe = senderId === myId;

        setThreads((prev) => {
          const list = prev[peerUserId] || [];
          if (list.some((m) => String(m.id) === String(uiMsg.id))) {
            return prev;
          }
          let nextMsg = uiMsg;
          if (nextMsg.parentMessageId && !nextMsg.replyTo?.text) {
            const parent = list.find(
              (m) => String(m.id) === String(nextMsg.parentMessageId)
            );
            if (parent) {
              nextMsg = {
                ...nextMsg,
                replyTo: buildReplyPreview(
                  parent,
                  parent.from === "me" ? "You" : "Contact"
                ),
              };
            }
          }
          return {
            ...prev,
            [peerUserId]: attachReplyPreviews([...list, nextMsg], "Contact"),
          };
        });

        setChatList((prev) => {
          const exists = prev.some((c) => String(c.id) === String(peerUserId));
          if (!exists) return prev;
          return prev.map((chat) => {
            if (String(chat.id) !== String(peerUserId)) return chat;
            return {
              ...chat,
              preview: uiMsg.text || chat.preview,
              time: uiMsg.time || chat.time,
              unread:
                viewingThisChat || isFromMe
                  ? 0
                  : Number(chat.unread || 0) + 1,
            };
          });
        });

        const incomingChatId = Number(
          payload.chatId ?? payload.ChatId ?? 0
        );
        if (Number.isFinite(incomingChatId) && incomingChatId > 0) {
          rememberConversationChatId(peerUserId, incomingChatId);
          if (viewingThisChat) {
            setSelectedChatId(incomingChatId);
          }
        }

        // Receiver online client: ack delivery to sender (not read).
        if (!isFromMe && Number.isFinite(incomingChatId) && incomingChatId > 0) {
          ackChatMessageDelivered(uiMsg.id, senderId, incomingChatId);
        }

        // If this chat is open, mark inbound messages as read.
        if (!isFromMe && viewingThisChat) {
          const chatIdForRead =
            (Number.isFinite(incomingChatId) && incomingChatId > 0
              ? incomingChatId
              : null) ||
            Number(selectedChatIdRef.current) ||
            Number(conversationChatIdsRef.current[peerUserId]);
          if (chatIdForRead) {
            markActiveChatRead(chatIdForRead, peerUserId);
          }
        }
      }
    });
    return unsubscribe;
  }, [me.userId]);

  const rememberConversationChatId = (userId, chatId) => {
    const key = String(userId);
    setConversationChatIds((prev) => {
      if (String(prev[key]) === String(chatId)) return prev;
      const next = { ...prev, [key]: chatId };
      conversationChatIdsRef.current = next;
      return next;
    });
  };

  const openChat = (chatId) => {
    const id = chatId == null ? null : String(chatId);
    setActiveChatId(id);
    setMsgMenu(null);
    setReplyTo(null);
    setPendingAttach((prev) => {
      if (prev?.previewUrl) {
        try {
          URL.revokeObjectURL(prev.previewUrl);
        } catch {
          /* ignore */
        }
      }
      return null;
    });
    setAttachCaption("");
    if (id) writeChatUiState({ activeUserId: id });
    if (id) {
      setChatList((prev) =>
        prev.map((chat) =>
          String(chat.id) === id ? { ...chat, unread: 0 } : chat
        )
      );
    }
    setShowContactPanel(false);
    setShowAttachMenu(false);
    setShowMoreMenu(false);
    setShowChatSearch(false);
    setChatSearchQuery("");
    setSelectMode(false);
    setSelectedMessageIds([]);
    if (id && window.innerWidth < 992 && userChatShow.current) {
      userChatShow.current.classList.add("user-chat-show");
    }
  };

  const backToUserChat = () => {
    userChatShow.current?.classList.remove("user-chat-show");
  };

  const scrollToBottom = useCallback(() => {
    if (!messageBox) return;
    requestAnimationFrame(() => {
      messageBox.scrollTop = messageBox.scrollHeight + 1000;
    });
  }, [messageBox]);

  const handleMessageBoxScroll = useCallback(() => {
    if (!messageBox) return;
    const distanceFromBottom =
      messageBox.scrollHeight - messageBox.scrollTop - messageBox.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 96;
  }, [messageBox]);

  useEffect(() => {
    if (!messageBox) return undefined;
    messageBox.addEventListener("scroll", handleMessageBoxScroll);
    return () => messageBox.removeEventListener("scroll", handleMessageBoxScroll);
  }, [messageBox, handleMessageBoxScroll]);

  // Open chat from notification click (peer user + optional focus message_id)
  useEffect(() => {
    if (!chatList.length) return;

    const peerFromNav = location.state?.openPeerUserId;
    const focusFromNav = location.state?.focusMessageId;
    const stored = readChatUiState();
    const peerId = peerFromNav || stored.activeUserId;
    const focusId =
      focusFromNav != null && focusFromNav !== ""
        ? String(focusFromNav)
        : stored.focusMessageId
          ? String(stored.focusMessageId)
          : null;

    if (!peerFromNav && !focusFromNav) return;

    const peer = peerFromNav ? String(peerFromNav) : null;
    if (peer) {
      const exists = chatList.some((c) => String(c.id) === peer);
      if (exists) {
        openChat(peer);
        if (focusId) setFocusMessageId(focusId);
      }
    } else if (focusId) {
      setFocusMessageId(focusId);
    }

    writeChatUiState({ focusMessageId: focusId || null });
    if (location.state?.openPeerUserId || location.state?.focusMessageId) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [chatList, location.state, location.pathname, navigate]);

  // After history loads, scroll to the notification's message (reference_id / message_id)
  useEffect(() => {
    if (!focusMessageId || messagesLoading) return;
    const threadMsgs = activeChatId
      ? threads[String(activeChatId)] || []
      : [];
    const hasTarget = threadMsgs.some(
      (m) => String(m.id) === String(focusMessageId)
    );
    if (!hasTarget) return;

    const timer = window.setTimeout(() => {
      const el = document.getElementById(`chat-msg-${focusMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("is-focused-msg");
        window.setTimeout(() => el.classList.remove("is-focused-msg"), 2000);
      }
      setFocusMessageId(null);
      writeChatUiState({ focusMessageId: null });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusMessageId, messagesLoading, threads, activeChatId]);

  const showToast = (message) => {
    setActionToast(message);
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setActionToast(""), 2500);
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

    const threadMsgs = activeChatId
      ? threads[String(activeChatId)] || []
      : messages || [];
    const exists = threadMsgs.some((m) => String(m.id) === targetId);
    if (!exists) {
      showToast("Original message not found in this chat.");
      return;
    }

    // WhatsApp-style: scroll + highlight immediately when the DOM node exists.
    const el = document.getElementById(`chat-msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("is-focused-msg");
      window.clearTimeout(jumpToRepliedMessage._highlightTimer);
      jumpToRepliedMessage._highlightTimer = window.setTimeout(() => {
        el.classList.remove("is-focused-msg");
      }, 1800);
      setFocusMessageId(null);
      writeChatUiState({ focusMessageId: null });
      return;
    }

    // Fallback: let the focus effect run after render.
    setFocusMessageId(targetId);
    writeChatUiState({ focusMessageId: targetId });
  };

  const updateActiveChat = (patch) => {
    if (!activeChatId) return;
    setChatList((prev) =>
      prev.map((chat) => (chat.id === activeChatId ? { ...chat, ...patch } : chat))
    );
  };

  const getActiveMessages = () => {
    if (!activeChat) return [];
    return (threads[activeChat.id] || []).filter(
      (msg) => !deletedForMeIds.has(String(msg.id))
    );
  };

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      setUsersLoading(true);
      setUsersError("");

      try {
        const orgId = getSessionPublicOrgId();
        const productId = getConfiguredProductId();
        const me = getSessionUserIdentity();

        if (!orgId) {
          throw new Error("Organisation ID missing from login session. Please sign in again.");
        }
        if (!productId) {
          throw new Error("Product ID is not configured.");
        }

        const response = await getOrganisationProductUsers(orgId, productId);
        const rows = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.users)
              ? response.users
              : [];

        const mapped = rows
          .filter(Boolean)
          .map((user) => mapApiUserToChat(user, me));

        let selfChat = mapped.find((chat) => chat.isSelf) || null;
        const others = mapped.filter((chat) => !chat.isSelf);

        if (!selfChat) {
          selfChat = buildSelfChatFromSession(me);
        }

        let finalList = selfChat ? [selfChat, ...others] : others;

        // Current user profile (GET /api/profile) — Number / Email / image for "You"
        try {
          const profile = await getSoftOnCloudProfile();
          if (profile) {
            finalList = finalList.map((chat) =>
              chat.isSelf ? applyProfileToSelfChat(chat, profile) : chat
            );
          }
        } catch {
          // Product-users list + session still usable if profile API is unavailable.
        }

        // Apply DB unread counts (WhatsApp-style green badges after login / refresh).
        try {
          const unreadResult = await getChatUnreadCountsByPeer();
          const unreadMap = new Map(
            (unreadResult?.items || []).map((row) => [
              String(row.peerUserId),
              Number(row.unreadCount) || 0,
            ])
          );
          if (unreadMap.size) {
            finalList = finalList.map((chat) => {
              if (chat.isSelf) return chat;
              const count = unreadMap.get(String(chat.id)) || 0;
              return count > 0 ? { ...chat, unread: count } : chat;
            });
          }
        } catch {
          // Chat list still usable if unread endpoint / SQL is not applied yet.
        }

        if (cancelled) return;

        setChatList(finalList);

        const savedUserId = readChatUiState().activeUserId;
        const savedFocusMessageId = readChatUiState().focusMessageId;
        // Only restore a previously opened chat — do not auto-open the first contact,
        // otherwise unread badges are cleared immediately on login.
        const restored = savedUserId
          ? finalList.find((chat) => String(chat.id) === String(savedUserId)) ||
            null
          : null;

        const nextActiveId = restored ? String(restored.id) : null;
        setActiveChatId(nextActiveId);
        if (nextActiveId) writeChatUiState({ activeUserId: nextActiveId });
        if (savedFocusMessageId) {
          setFocusMessageId(String(savedFocusMessageId));
        }
      } catch (error) {
        if (cancelled) return;
        setChatList([]);
        setActiveChatId(null);
        setUsersError(error?.message || "Failed to load users.");
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    };

    loadUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onDocClick = (event) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target)) {
        setShowAttachMenu(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
      if (msgMenuRef.current && !msgMenuRef.current.contains(event.target)) {
        setMsgMenu(null);
      }
      if (
        emojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setemojiPicker(false);
      }
      if (
        reactionPickerMsg &&
        !event.target.closest?.(".comm-reaction-emoji-picker") &&
        !event.target.closest?.(".comm-react-plus")
      ) {
        setReactionPickerMsg(null);
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setMsgMenu(null);
        setShowAttachMenu(false);
        setemojiPicker(false);
        setReactionPickerMsg(null);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [emojiPicker, reactionPickerMsg]);

  useEffect(() => {
    setReactionPickerMsg(null);
  }, [activeChatId]);

  useEffect(() => {
    if (!activeChatId || !activeChat) return;

    const threadKey = String(activeChatId);

    if (activeChat.isSelf) {
      setMessagesError("");
      setMessagesLoading(false);
      setSelectedChatId(null);
      setThreads((prev) =>
        prev[threadKey] ? prev : { ...prev, [threadKey]: [] }
      );
      return;
    }

    const receiverUserId = Number(activeChat.id);
    if (!Number.isFinite(receiverUserId) || receiverUserId <= 0) {
      setMessagesError("Selected user does not have a valid user id.");
      return;
    }

    const myUserId = Number(me.userId);
    if (!Number.isFinite(myUserId) || myUserId <= 0) {
      setMessagesError("Logged-in user id missing from session/JWT.");
      return;
    }

    let cancelled = false;
    const seq = ++loadSeqRef.current;

    const loadConversation = async () => {
      setMessagesLoading(true);
      setMessagesError("");
      setSelectedChatId(null);

      let resolvedChatId = null;

      try {
        const privateChat = await getOrCreatePrivateChat(myUserId, receiverUserId);
        resolvedChatId = extractChatId(privateChat);

        if (!resolvedChatId) {
          throw new Error("Get/Create Chat did not return chatId.");
        }

        if (!cancelled && seq === loadSeqRef.current) {
          setSelectedChatId(resolvedChatId);
          rememberConversationChatId(threadKey, resolvedChatId);
        }

        const rows = await getChatMessages(resolvedChatId);
        const peerName =
          chatList.find((c) => String(c.id) === threadKey && !c.isSelf)?.realName ||
          chatList.find((c) => String(c.id) === threadKey && !c.isSelf)?.name ||
          "";
        const withReplies = attachReplyPreviews(
          (rows || []).map((row) =>
            mapApiMessageToUi(
              row,
              myUserId,
              onlineUserIdsRef.current.has(threadKey)
            )
          ),
          peerName
        );

        if (cancelled || seq !== loadSeqRef.current) return;

        setThreads((prev) => ({ ...prev, [threadKey]: withReplies }));

        const last = withReplies[withReplies.length - 1];
        if (last) {
          setChatList((prev) =>
            prev.map((chat) =>
              String(chat.id) === threadKey
                ? {
                    ...chat,
                    preview: last.text || chat.preview,
                    time: last.time || chat.time,
                    unread: 0,
                  }
                : chat
            )
          );
        }

        markActiveChatRead(resolvedChatId, threadKey);
      } catch (error) {
        if (cancelled || seq !== loadSeqRef.current) return;
        const status = error?.status;
        let message = error?.message || "Failed to load messages.";
        if (status === 401) {
          message =
            "Session expired or unauthorized (401). Please sign in again.";
        } else if (status === 403) {
          message = error?.message || "Access denied (403).";
        }
        setMessagesError(message);
        if (!resolvedChatId) {
          setSelectedChatId(null);
        }
        setThreads((prev) => ({ ...prev, [threadKey]: prev[threadKey] || [] }));
      } finally {
        if (!cancelled && seq === loadSeqRef.current) {
          setMessagesLoading(false);
        }
      }
    };

    loadConversation();
    return () => {
      cancelled = true;
    };
  }, [activeChatId, activeChat?.id, activeChat?.isSelf, me.userId]);

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return chatList.filter((chat) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "groups" && chat.type === "group") ||
        (activeTab === "starred" && chat.starred);
      const matchesSearch =
        !q ||
        chat.name.toLowerCase().includes(q) ||
        String(chat.realName || "").toLowerCase().includes(q) ||
        String(chat.email || "").toLowerCase().includes(q) ||
        chat.preview.toLowerCase().includes(q) ||
        (chat.isSelf && "you".includes(q));
      return matchesTab && matchesSearch;
    });
  }, [activeTab, search, chatList]);

  const messages = activeChat
    ? (threads[String(activeChat.id)] || []).filter(
        (msg) => !deletedForMeIds.has(String(msg.id))
      )
    : [];

  const attachedFiles = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      const path =
        msg?.attachmentPath1 ||
        msg?.raw?.attachmentPath1 ||
        msg?.raw?.AttachmentPath1 ||
        msg?.raw?.attachment_path_1 ||
        null;
      if (!path) continue;
      const key = String(path);
      if (seen.has(key)) continue;
      seen.add(key);
      const rawName =
        msg?.fileName ||
        String(path).split("/").pop() ||
        "attachment";
      const foldername = cleanAttachmentDisplayName(rawName);
      const kindIcon = attachIconForMessage(msg);
      list.push({
        id: String(msg.id || key),
        path: key,
        foldername,
        foldericon:
          kindIcon !== "ri-attachment-2"
            ? kindIcon
            : attachmentIconForFileName(foldername),
        foldersize: "",
        message: msg,
      });
    }
    return list;
  }, [messages]);

  const starredMessagesForContact = useMemo(() => {
    return messages
      .filter((msg) => Boolean(msg?.starred))
      .slice()
      .reverse()
      .map((msg) => ({
        id: String(msg.id),
        preview:
          msg.fileName ||
          msg.text ||
          (msg.attachmentPath1
            ? String(msg.attachmentPath1).split("/").pop()
            : "Starred message"),
        time: msg.time || "",
        message: msg,
      }));
  }, [messages]);

  const sendOutboundMessage = async (rawText, options = {}) => {
    if (!activeChat || sending) return false;
    const text = String(rawText || "").trim();
    const attachmentPath1 = options.attachmentPath1
      ? String(options.attachmentPath1).trim()
      : "";
    if (!text && !attachmentPath1) return false;

    const threadKey = String(activeChat.id);
    const messageTypeId = Number(options.messageTypeId) > 0 ? Number(options.messageTypeId) : 1;
    const replySource = options.replyTo || replyTo || null;
    const replyPreview = buildReplyPreview(
      replySource,
      activeChat.isSelf ? "You" : activeChat.realName || activeChat.name || ""
    );
    const parentIdNum = Number(
      options.parentMessageId ?? replySource?.id ?? replyPreview?.id
    );
    const parentMessageId =
      Number.isFinite(parentIdNum) && parentIdNum > 0 ? parentIdNum : null;

    if (activeChat.isSelf) {
      const attach = resolveAttachMeta(text, null);
      const next = {
        id: `local-${Date.now()}`,
        from: "me",
        text: attach?.caption || attach?.text || text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        read: true,
        status: MSG_STATUS.READ,
        type: attach ? "file" : "text",
        attachKind: attach?.attachKind || null,
        mediaSubtype: attach?.mediaSubtype || null,
        fileName: attach?.fileName || null,
        caption: attach?.caption || null,
        parentMessageId,
        replyTo: replyPreview,
      };
      setThreads((prev) => ({
        ...prev,
        [threadKey]: [...(prev[threadKey] || []), next],
      }));
      setChatList((prev) =>
        prev.map((chat) =>
          String(chat.id) === threadKey
            ? { ...chat, preview: next.fileName || next.text, time: next.time }
            : chat
        )
      );
      setShowAttachMenu(false);
      setReplyTo(null);
      stickToBottomRef.current = true;
      scrollToBottom();
      return true;
    }

    const myUserId = Number(me.userId);
    const receiverUserId = Number(activeChat.id);
    if (!Number.isFinite(myUserId) || myUserId <= 0) {
      showToast("Logged-in user id missing from session/JWT.");
      return false;
    }
    if (!Number.isFinite(receiverUserId) || receiverUserId <= 0) {
      showToast("Selected receiver user id is invalid.");
      return false;
    }

    setSending(true);
    setMessagesError("");

    try {
      let chatId = Number(selectedChatId);
      if (!Number.isFinite(chatId) || chatId <= 0) {
        chatId = Number(conversationChatIdsRef.current[threadKey]);
      }
      if (!Number.isFinite(chatId) || chatId <= 0) {
        chatId = null;
      }

      if (!chatId) {
        const privateChat = await getOrCreatePrivateChat(myUserId, receiverUserId);
        chatId = extractChatId(privateChat);
        if (!chatId) {
          throw new Error("Get/Create Chat did not return chatId.");
        }
      }

      setSelectedChatId(chatId);
      rememberConversationChatId(threadKey, chatId);

      const saved = await sendChatMessage(chatId, {
        receiverUserId,
        messageBody: text,
        messageTypeId,
        attachmentPath1: attachmentPath1 || null,
        parentMessageId,
      });

      const peerOnline = onlineUserIds.has(threadKey);
      const mapped = mapApiMessageToUi(saved, myUserId, peerOnline);
      const uiMsg = {
        ...mapped,
        parentMessageId: mapped.parentMessageId || parentMessageId,
        replyTo: {
          ...(replyPreview || {}),
          ...(mapped.replyTo || {}),
          id: String(
            mapped.replyTo?.id ||
              replyPreview?.id ||
              parentMessageId ||
              ""
          ).trim() || null,
          text:
            mapped.replyTo?.text ||
            replyPreview?.text ||
            "",
          name:
            mapped.replyTo?.name ||
            replyPreview?.name ||
            "",
        },
      };
      if (!uiMsg.replyTo?.text) {
        uiMsg.replyTo = replyPreview;
      }
      setThreads((prev) => {
        const list = prev[threadKey] || [];
        if (list.some((m) => String(m.id) === String(uiMsg.id))) return prev;
        return { ...prev, [threadKey]: [...list, uiMsg] };
      });
      setChatList((prev) =>
        prev.map((chat) =>
          String(chat.id) === threadKey
            ? {
                ...chat,
                preview: uiMsg.fileName || uiMsg.text || text,
                time: uiMsg.time,
              }
            : chat
        )
      );
      setShowAttachMenu(false);
      setReplyTo(null);
      setMessagesError("");
      stickToBottomRef.current = true;
      scrollToBottom();
      return true;
    } catch (error) {
      showToast(error?.message || "Failed to send message.");
      setMessagesError(error?.message || "Failed to send message.");
      return false;
    } finally {
      setSending(false);
    }
  };

  const onEmojiClick = (emojiData) => {
    const emoji = emojiData?.emoji || "";
    if (!emoji) return;
    setDraft((prev) => `${prev || ""}${emoji}`);
  };

  const openReactionEmojiPicker = (msg, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setemojiPicker(false);
    setReactionPickerMsg(msg || null);
    try {
      document.body.click();
    } catch {
      /* ignore */
    }
  };

  const onReactionEmojiClick = (emojiData) => {
    const emoji = emojiData?.emoji || "";
    const code = emojiToReactionCode(emoji);
    if (!reactionPickerMsg) return;
    if (!code) {
      showToast("Only 👍 ❤️ 😂 😮 😢 🙏 reactions are allowed.");
      return;
    }
    toggleMessageReaction(reactionPickerMsg, code);
    setReactionPickerMsg(null);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!canAdd) {
      showToast("You do not have permission to send messages.");
      return;
    }
    const text = draft.trim();
    if (!text) return;
    const ok = await sendOutboundMessage(text, { messageTypeId: 1 });
    if (ok) {
      setDraft("");
      notifyPeerTyping(false);
      if (activeChatId) clearComposerDraft(dmDraftKey(activeChatId));
      setemojiPicker(false);
    }
  };

  const openAttachPicker = (itemId) => {
    const item = attachMenuItems.find((entry) => entry.id === itemId);
    if (!item || !attachFileInputRef.current) return;
    pendingAttachKindRef.current = item.id;
    attachFileInputRef.current.accept = item.accept;
    attachFileInputRef.current.value = "";
    setShowAttachMenu(false);
    attachFileInputRef.current.click();
  };

  const clearPendingAttach = () => {
    setPendingAttach((prev) => {
      if (prev?.previewUrl) {
        try {
          URL.revokeObjectURL(prev.previewUrl);
        } catch {
          /* ignore */
        }
      }
      return null;
    });
    setAttachCaption("");
    setImageDrawMode(false);
    setDrawStrokes([]);
    drawingStrokeRef.current = null;
    isDrawingRef.current = false;
  };

  const syncAttachDrawCanvas = useCallback(() => {
    const img = previewImgRef.current;
    const canvas = drawCanvasRef.current;
    if (!img || !canvas) return;
    const w = Math.max(1, img.clientWidth || 0);
    const h = Math.max(1, img.clientHeight || 0);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = [
      ...drawStrokes,
      ...(drawingStrokeRef.current ? [drawingStrokeRef.current] : []),
    ];
    all.forEach((stroke) => {
      const pts = stroke?.points || [];
      if (pts.length < 2) return;
      ctx.strokeStyle = stroke.color || drawColor;
      ctx.lineWidth = stroke.width || 4;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    });
  }, [drawStrokes, drawColor]);

  useEffect(() => {
    syncAttachDrawCanvas();
  }, [syncAttachDrawCanvas, imageDrawMode, pendingAttach?.previewUrl]);

  const getDrawPoint = (event) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX ?? event.touches?.[0]?.clientX;
    const clientY = event.clientY ?? event.touches?.[0]?.clientY;
    if (clientX == null || clientY == null) return null;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleDrawPointerDown = (event) => {
    if (!imageDrawMode) return;
    event.preventDefault();
    const point = getDrawPoint(event);
    if (!point) return;
    isDrawingRef.current = true;
    drawingStrokeRef.current = {
      color: drawColor,
      width: 4,
      points: [point],
    };
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
    syncAttachDrawCanvas();
  };

  const handleDrawPointerMove = (event) => {
    if (!imageDrawMode || !isDrawingRef.current || !drawingStrokeRef.current) {
      return;
    }
    event.preventDefault();
    const point = getDrawPoint(event);
    if (!point) return;
    drawingStrokeRef.current.points.push(point);
    syncAttachDrawCanvas();
  };

  const handleDrawPointerUp = (event) => {
    if (!isDrawingRef.current) return;
    event.preventDefault();
    isDrawingRef.current = false;
    const stroke = drawingStrokeRef.current;
    drawingStrokeRef.current = null;
    if (stroke?.points?.length > 1) {
      setDrawStrokes((prev) => [...prev, stroke]);
    } else {
      syncAttachDrawCanvas();
    }
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleAttachFileChange = (event) => {
    const file = event.target.files?.[0];
    const kind = pendingAttachKindRef.current;
    event.target.value = "";
    pendingAttachKindRef.current = null;
    if (!file || !kind) return;

    const kindError = validateAttachFileKind(kind, file);
    if (kindError) {
      showToast(kindError);
      return;
    }

    const maxBytes = maxFileSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      showToast(`File size cannot exceed ${maxFileSizeMB} MB.`);
      return;
    }

    clearPendingAttach();
    const previewUrl =
      String(file.type || "").startsWith("image/") ||
      String(file.type || "").startsWith("video/")
        ? URL.createObjectURL(file)
        : null;
    setPendingAttach({ file, kind, previewUrl });
    setAttachCaption("");
    setImageDrawMode(false);
    setDrawStrokes([]);
    window.setTimeout(() => attachCaptionRef.current?.focus(), 50);
  };

  const sendPendingAttach = async () => {
    if (!pendingAttach?.file || uploading || sending) return;
    const { file, kind, previewUrl } = pendingAttach;
    setUploading(true);
    try {
      let uploadFile = file;
      const isImage = String(file.type || "").startsWith("image/");
      if (isImage && drawStrokes.length && previewUrl) {
        const canvas = drawCanvasRef.current;
        const img = previewImgRef.current;
        uploadFile = await composeDrawnImageFile(file, previewUrl, drawStrokes, {
          width: canvas?.width || img?.clientWidth,
          height: canvas?.height || img?.clientHeight,
        });
      }
      const body = formatAttachMessageBody(kind, uploadFile, attachCaption);
      const uploaded = await uploadChatAttachments(uploadFile);
      const path = pickUploadedAttachmentPath(uploaded);

      if (!path) {
        showToast("Upload succeeded but no file path was returned.");
        return;
      }

      const ok = await sendOutboundMessage(body, {
        messageTypeId: attachKindToMessageTypeId(kind),
        attachmentPath1: path,
      });
      if (ok) clearPendingAttach();
    } catch (error) {
      showToast(error?.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };
  useEffect(() => {
    if (showChatSearch && chatSearchInputRef.current) {
      chatSearchInputRef.current.focus();
    }
  }, [showChatSearch]);

  const visibleMessages = useMemo(() => {
    let list = messages;
    if (chatSearchQuery.trim()) {
      const q = chatSearchQuery.trim().toLowerCase();
      list = messages.filter((msg) =>
        String(msg.text || msg.fileName || "")
          .toLowerCase()
          .includes(q)
      );
    }
    return withDateSeparators(list, dateFormat);
  }, [messages, chatSearchQuery, dateFormat]);

  const contactsByLetter = useMemo(() => {
    const groups = {};
    filteredChats.forEach((chat) => {
      const letter = String(chat.name || "?")
        .charAt(0)
        .toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(chat);
    });
    return Object.keys(groups)
      .sort()
      .map((letter) => ({ letter, contacts: groups[letter] }));
  }, [filteredChats]);

  useEffect(() => {
    if (!messagesLoading && visibleMessages.length && stickToBottomRef.current) {
      scrollToBottom();
    }
  }, [visibleMessages, messagesLoading, scrollToBottom]);

  useEffect(() => {
    stickToBottomRef.current = true;
  }, [activeChatId]);

  const toggleMessageSelect = (messageId) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId]
    );
  };

  const handleMoreAction = async (itemId) => {
    setShowMoreMenu(false);
    if (!activeChat && itemId !== "close-chat") return;
    if (chatListActionBusy && (itemId === "clear" || itemId === "delete")) return;

    switch (itemId) {
      case "contact-info":
        setShowContactPanel(true);
        break;
      case "search":
        setShowChatSearch(true);
        setSelectMode(false);
        setsearch_Menu(true);
        break;
      case "select":
        setSelectMode(true);
        setSelectedMessageIds([]);
        setShowChatSearch(false);
        break;
      case "mute": {
        const nextMute = !(activeChat.muted || muteNotifications);
        setMuteNotifications(nextMute);
        updateActiveChat({ muted: nextMute });
        showToast(nextMute ? "Notifications muted" : "Notifications unmuted");
        break;
      }
      case "export": {
        const msgs = getActiveMessages();
        const dateFormat = getChatDateFormat();
        const lines = [];
        let lastDayKey = "";
        msgs.forEach((msg) => {
          const dayKey = getMessageDayKey(msg);
          if (dayKey && dayKey !== lastDayKey) {
            if (lines.length) lines.push("");
            const dayLabel = formatChatDayLabel(
              msg.sentAt || msg?.raw?.sentAt || msg?.raw?.SentAt,
              dateFormat
            );
            lines.push(`--- ${dayLabel || dayKey} ---`);
            lastDayKey = dayKey;
          }
          const who = msg.from === "me" ? "You" : activeChat.name;
          const body =
            msg.type === "file" ? `[File] ${msg.fileName}` : msg.text;
          lines.push(`[${msg.time || "-"}] ${who}: ${body || ""}`);
        });
        const blob = new Blob(
          [
            `Chat with ${activeChat.name}\n\n${
              lines.length ? lines.join("\n") : "No messages"
            }\n`,
          ],
          { type: "text/plain;charset=utf-8" }
        );
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `chat-${String(activeChat.name)
          .replace(/\s+/g, "-")
          .toLowerCase()}.txt`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast("Chat exported");
        break;
      }
      case "close-chat":
        setShowContactPanel(false);
        setShowChatSearch(false);
        setSelectMode(false);
        setSelectedMessageIds([]);
        setActiveChatId(null);
        backToUserChat();
        break;
      case "clear": {
        if (!window.confirm("Clear this chat?")) break;
        const threadKey = String(activeChat.id);
        const dbChatId =
          Number(selectedChatId) ||
          Number(conversationChatIdsRef.current[threadKey]) ||
          0;
        setChatListActionBusy(true);
        try {
          if (Number.isFinite(dbChatId) && dbChatId > 0) {
            await clearChat(dbChatId);
          }
          setThreads((prev) => ({ ...prev, [threadKey]: [] }));
          setSelectedMessageIds([]);
          setSelectMode(false);
          showToast("Chat cleared");
        } catch (error) {
          showToast(error?.message || "Failed to clear chat.");
        } finally {
          setChatListActionBusy(false);
        }
        break;
      }
      case "delete": {
        if (activeChat.isSelf) {
          showToast("You chat cannot be deleted");
          break;
        }
        if (!window.confirm(`Delete chat with ${activeChat.name}?`)) break;
        const threadKey = String(activeChat.id);
        const dbChatId =
          Number(selectedChatId) ||
          Number(conversationChatIdsRef.current[threadKey]) ||
          0;
        setChatListActionBusy(true);
        try {
          if (Number.isFinite(dbChatId) && dbChatId > 0) {
            await deleteChat(dbChatId);
          }
          setThreads((prev) => {
            const next = { ...prev };
            delete next[threadKey];
            return next;
          });
          setConversationChatIds((prev) => {
            const next = { ...prev };
            delete next[threadKey];
            return next;
          });
          setChatList((prev) => prev.filter((chat) => String(chat.id) !== threadKey));
          setSelectedChatId(null);
          setSelectedMessageIds([]);
          setSelectMode(false);
          setShowContactPanel(false);
          setActiveChatId(null);
          backToUserChat();
          showToast("Chat deleted");
        } catch (error) {
          showToast(error?.message || "Failed to delete chat.");
        } finally {
          setChatListActionBusy(false);
        }
        break;
      }
      default:
        break;
    }
  };

  const getMessageAttachmentPath = (msg) =>
    msg?.attachmentPath1 ||
    msg?.raw?.attachmentPath1 ||
    msg?.raw?.AttachmentPath1 ||
    msg?.raw?.attachment_path_1 ||
    null;

  const isAttachmentDownloaded = (msg) => {
    // Own sends are already on this device — WhatsApp-style, no download needed.
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

  const downloadChatAttachment = async (msg) => {
    const path = getMessageAttachmentPath(msg);
    const key = getAttachmentStorageKey(msg);
    if (!path) {
      showToast("File path not available for download");
      return;
    }

    const fileName =
      msg?.fileName ||
      String(path).split("/").pop() ||
      "attachment";

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
      // Authenticated API download → blob → browser save dialog (no new tab).
      const blob = await fetchChatAttachmentBlob(path);
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
    } catch (err) {
      console.error("Attachment download failed:", err);
      showToast(err?.message || "Download failed. Please try again.");
    } finally {
      clearDownloading();
    }
  };

  const handleAttachmentClick = (msg) => {
    if (!getMessageAttachmentPath(msg)) {
      showToast("File path not available for download");
      return;
    }
    // Photos/videos that are already downloaded open on click.
    // Documents / pending media always download via the browser.
    const isMedia =
      msg?.mediaSubtype === "photo" || msg?.mediaSubtype === "video";
    if (isMedia && isAttachmentDownloaded(msg)) {
      openChatAttachment(msg);
      return;
    }
    if (!isAttachmentDownloaded(msg)) {
      downloadChatAttachment(msg);
      return;
    }
    // Downloaded document/audio — open for viewing
    openChatAttachment(msg);
  };

  const toggleMessageReaction = async (msg, reactionCodeOrEmoji) => {
    if (!msg?.id || !activeChatId) return;
    const code = normalizeReactionCode(reactionCodeOrEmoji);
    if (!code) {
      showToast("Invalid reaction. Allowed: LIKE, LOVE, LAUGH, WOW, SAD, THANKS.");
      return;
    }
    const nextCode = msg.reactionCode === code ? null : code;
    const nextEmoji = nextCode ? reactionCodeToEmoji(nextCode) : null;
    const previousCode = msg.reactionCode || null;
    const previousMyEmoji = previousCode
      ? reactionCodeToEmoji(previousCode)
      : null;
    const messageId =
      msg?.raw?.messageId ??
      msg?.raw?.MessageId ??
      msg?.id;
    const parsedMessageId = Number(messageId);
    if (!Number.isFinite(parsedMessageId) || parsedMessageId <= 0) {
      showToast("Cannot react to this message (missing message id).");
      return;
    }

    setThreads((prev) => {
      const key = String(activeChatId);
      const list = prev[key] || [];
      return {
        ...prev,
        [key]: list.map((m) =>
          String(m.id) === String(msg.id)
            ? patchMessageReactions(m, {
                reactionCode: nextCode,
                myEmoji: nextEmoji,
              })
            : m
        ),
      };
    });
    const stored = readStoredReactions();
    if (nextCode) stored[String(msg.id)] = { code: nextCode, emoji: nextEmoji };
    else delete stored[String(msg.id)];
    writeStoredReactions(stored);
    setReactionPickerMsg(null);

    try {
      const result = await toggleChatMessageReaction(parsedMessageId, nextCode);
      const confirmedCodeRaw =
        result?.reactionCode ?? result?.ReactionCode ?? nextCode;
      const confirmedCode =
        confirmedCodeRaw == null || String(confirmedCodeRaw).trim() === ""
          ? null
          : normalizeReactionCode(confirmedCodeRaw);
      const confirmedEmoji =
        result?.reaction ??
        result?.Reaction ??
        result?.reactionEmoji ??
        result?.ReactionEmoji ??
        (confirmedCode ? reactionCodeToEmoji(confirmedCode) : null);
      setThreads((prev) => {
        const key = String(activeChatId);
        return {
          ...prev,
          [key]: (prev[key] || []).map((m) =>
            String(m.id) === String(msg.id)
              ? patchMessageReactions(m, {
                  reactionCode: confirmedCode,
                  myEmoji: confirmedEmoji,
                })
              : m
          ),
        };
      });
      const storedAfter = readStoredReactions();
      if (confirmedCode)
        storedAfter[String(msg.id)] = {
          code: confirmedCode,
          emoji: confirmedEmoji,
        };
      else delete storedAfter[String(msg.id)];
      writeStoredReactions(storedAfter);
    } catch (error) {
      setThreads((prev) => {
        const key = String(activeChatId);
        return {
          ...prev,
          [key]: (prev[key] || []).map((m) =>
            String(m.id) === String(msg.id)
              ? patchMessageReactions(m, {
                  reactionCode: previousCode,
                  myEmoji: previousMyEmoji,
                })
              : m
          ),
        };
      });
      const storedRollback = readStoredReactions();
      if (previousCode)
        storedRollback[String(msg.id)] = {
          code: previousCode,
          emoji: previousMyEmoji,
        };
      else delete storedRollback[String(msg.id)];
      writeStoredReactions(storedRollback);
      showToast(error?.message || "Failed to save reaction.");
    }
  };

  const handleMessageAction = async (actionId, messageOverride = null) => {
    const msg = messageOverride || msgMenu?.message;
    setMsgMenu(null);
    if (!msg || !activeChat) return;

    switch (actionId) {
      case "reply":
        setReplyTo(msg);
        window.setTimeout(() => draftInputRef.current?.focus(), 0);
        break;
      case "copy": {
        const text = msg.type === "file" ? msg.fileName || "" : msg.text || "";
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
        downloadChatAttachment(msg);
        break;
      case "forward":
        openForwardModal(msg);
        break;
      case "star": {
        const messageId =
          msg?.raw?.messageId ??
          msg?.raw?.MessageId ??
          msg?.id;
        const parsedMessageId = Number(messageId);
        if (!Number.isFinite(parsedMessageId) || parsedMessageId <= 0) {
          showToast("Cannot star this message (missing message id).");
          break;
        }

        const nextStar = !msg.starred;
        const threadKey = String(activeChat.id);
        const previousStar = Boolean(msg.starred);
        setThreads((prev) => ({
          ...prev,
          [threadKey]: (prev[threadKey] || []).map((m) =>
            String(m.id) === String(msg.id) ? { ...m, starred: nextStar } : m
          ),
        }));
        try {
          const result = await toggleChatMessageStar(parsedMessageId, nextStar);
          const confirmed = Boolean(
            result?.isStarredByMe ?? result?.IsStarredByMe ?? nextStar
          );
          const starredAt =
            result?.starredAt ?? result?.StarredAt ?? null;
          setThreads((prev) => ({
            ...prev,
            [threadKey]: (prev[threadKey] || []).map((m) =>
              String(m.id) === String(msg.id)
                ? { ...m, starred: confirmed, starredAt }
                : m
            ),
          }));
          showToast(confirmed ? "Starred" : "Removed from starred");
        } catch (error) {
          setThreads((prev) => ({
            ...prev,
            [threadKey]: (prev[threadKey] || []).map((m) =>
              String(m.id) === String(msg.id)
                ? { ...m, starred: previousStar }
                : m
            ),
          }));
          showToast(error?.message || "Failed to update star.");
        }
        break;
      }
      case "more":
        setSelectMode(true);
        setSelectedMessageIds([msg.id]);
        break;
      case "delete":
        setDeleteDialog({ messages: [msg] });
        break;
      default:
        break;
    }
  };

  const closeDeleteDialog = () => {
    if (deletingMessages) return;
    setDeleteDialog(null);
  };

  const removeMessagesFromThread = (msgs) => {
    if (!activeChat || !msgs?.length) return;
    const ids = new Set(msgs.map((m) => String(m.id)));
    setThreads((prev) => ({
      ...prev,
      [activeChat.id]: (prev[activeChat.id] || []).filter(
        (m) => !ids.has(String(m.id))
      ),
    }));
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
        removeMessagesFromThread(ok);
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
      const rows = await getChatGroups();
      const mapped = (rows || [])
        .map((g) => {
          const groupId = Number(g.groupId ?? g.GroupId);
          const chatId = Number(g.chatId ?? g.ChatId);
          if (!Number.isFinite(groupId) || groupId <= 0) return null;
          if (!Number.isFinite(chatId) || chatId <= 0) return null;
          const name = g.groupName || g.GroupName || "Group";
          const avatarRaw =
            g.profilePic ||
            g.ProfilePic ||
            g.groupProfilePic ||
            g.GroupProfilePic ||
            null;
          return {
            targetType: "group",
            targetKey: `g:${groupId}`,
            id: `group-${groupId}`,
            groupId,
            chatId,
            name,
            role: "Group",
            email: "Group",
            avatarSrc: resolveUserAvatarUrl(groupId, avatarRaw),
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
    const users = chatList
      .filter((chat) => !chat.isSelf)
      .map((chat) => ({
        ...chat,
        targetType: "user",
        targetKey: `u:${chat.id}`,
      }));
    const combined = [...users, ...forwardGroups];
    if (!q) return combined;
    return combined.filter(
      (item) =>
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.realName || "").toLowerCase().includes(q) ||
        String(item.email || "").toLowerCase().includes(q) ||
        String(item.role || "").toLowerCase().includes(q)
    );
  }, [chatList, forwardGroups, forwardSearch]);

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
    loadForwardGroups();
  };

  const confirmForwardMessages = async () => {
    if (!forwardMessage || !forwardSelectedIds.length || forwarding) return;

    const myUserId = Number(me.userId);
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

          const receiverUserId = Number(target.id);
          if (!Number.isFinite(receiverUserId) || receiverUserId <= 0) {
            errors.push(target.targetKey);
            continue;
          }

          let chatId = Number(
            conversationChatIdsRef.current[String(receiverUserId)]
          );
          if (!Number.isFinite(chatId) || chatId <= 0) {
            const privateChat = await getOrCreatePrivateChat(
              myUserId,
              receiverUserId
            );
            chatId = extractChatId(privateChat);
          }
          if (!chatId) {
            throw new Error("Get/Create Chat did not return chatId.");
          }

          rememberConversationChatId(receiverUserId, chatId);

          const saved = await forwardChatMessage(originalMessageId, {
            destinationChatId: chatId,
            receiverUserId,
          });

          const peerOnline = onlineUserIds.has(String(receiverUserId));
          const uiMsg = mapApiMessageToUi(saved, myUserId, peerOnline);
          const threadKey = String(receiverUserId);
          const previewText =
            uiMsg.text ||
            uiMsg.fileName ||
            forwardMessage.text ||
            forwardMessage.fileName ||
            "Forwarded message";

          setThreads((prev) => {
            const list = prev[threadKey] || [];
            if (list.some((m) => String(m.id) === String(uiMsg.id))) return prev;
            return { ...prev, [threadKey]: [...list, uiMsg] };
          });
          setChatList((prev) =>
            prev.map((chat) =>
              String(chat.id) === threadKey
                ? {
                    ...chat,
                    preview: previewText,
                    time: uiMsg.time,
                  }
                : chat
            )
          );
          successCount += 1;
        } catch (err) {
          console.error("Forward failed:", err);
          errors.push(target.targetKey);
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
            : "Failed to forward message"
        );
      }
    } finally {
      setForwarding(false);
    }
  };

  useEffect(() => {
    if (!showContactPanel || !activeChat?.isSelf) {
      setSelfProfileLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setSelfProfileLoading(true);
      try {
        const profile = await getSoftOnCloudProfile();
        if (cancelled || !profile) return;
        setChatList((prev) =>
          prev.map((chat) =>
            chat.isSelf ? applyProfileToSelfChat(chat, profile) : chat
          )
        );
      } catch (error) {
        if (!cancelled) {
          showToast(formatProfileApiError(error, "GET /api/profile"));
        }
      } finally {
        if (!cancelled) setSelfProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showContactPanel, activeChat?.isSelf]);

  // Settings → Update Profile (and PersonalInfo Edit) refresh “You” contact panel
  useEffect(() => {
    const onProfileUpdated = (event) => {
      const profile = event?.detail?.profile;
      if (!profile) return;
      setChatList((prev) =>
        prev.map((chat) =>
          chat.isSelf ? applyProfileToSelfChat(chat, profile) : chat
        )
      );
    };
    window.addEventListener("chat-profile-updated", onProfileUpdated);
    return () => window.removeEventListener("chat-profile-updated", onProfileUpdated);
  }, []);

  // Settings → Date Format change updates chat day chips live
  useEffect(() => {
    const onDateFormatUpdated = (event) => {
      const next =
        event?.detail?.dateFormat || getChatDateFormat();
      setDateFormat(next);
    };
    window.addEventListener("chat-date-format-updated", onDateFormatUpdated);
    return () =>
      window.removeEventListener("chat-date-format-updated", onDateFormatUpdated);
  }, []);

  const handleSelfAvatarChange = async (fileOrDataUrl) => {
    if (!activeChat?.isSelf) {
      showToast("You can only change your own profile picture");
      return;
    }
    const myUserId = me.userId;
    if (!myUserId || String(activeChat.id) !== String(myUserId)) {
      showToast("Profile picture update denied");
      return;
    }

    setAvatarSaving(true);
    try {
      const result = await updateSoftOnCloudProfileImage(fileOrDataUrl);
      const saved =
        result?.profileImageUrl ||
        (typeof fileOrDataUrl === "string" ? fileOrDataUrl : null);
      if (!saved) throw new Error("Profile image URL missing from API response.");

      setChatList((prev) =>
        prev.map((chat) =>
          chat.isSelf || String(chat.id) === String(myUserId)
            ? { ...chat, avatarSrc: saved }
            : chat
        )
      );
      window.dispatchEvent(
        new CustomEvent("chat-profile-avatar-updated", {
          detail: { userId: String(myUserId), avatarUrl: saved },
        })
      );
      showToast("Profile picture updated");
    } catch (error) {
      showToast(formatProfileApiError(error, "PUT /api/profile/image"));
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleSelfProfileSave = async (fields) => {
    if (!activeChat?.isSelf) {
      showToast("You can only edit your own profile");
      return;
    }
    try {
      const updated = await updateSoftOnCloudProfile(fields);
      setChatList((prev) =>
        prev.map((chat) =>
          chat.isSelf ? applyProfileToSelfChat(chat, updated) : chat
        )
      );
      window.dispatchEvent(
        new CustomEvent("chat-profile-updated", {
          detail: { profile: updated },
        })
      );
      showToast("Profile updated");
      return updated;
    } catch (error) {
      showToast(formatProfileApiError(error, "PUT /api/profile"));
      throw error;
    }
  };

  const renderMessageTicks = (msg) => {
    if (msg.from !== "me") return null;
    const peerOnline =
      activeChat && !activeChat.isSelf
        ? onlineUserIds.has(String(activeChat.id))
        : false;
    const status = resolveOutgoingStatus(msg, peerOnline);
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

  const moreMenuItemsLive = moreMenuItems
    .filter((item) => {
      if (item.id === "delete" || item.id === "clear") return canDelete;
      if (item.id === "export") return canEdit || canAdd;
      return true;
    })
    .map((item) => {
      if (item.id === "mute") {
        return {
          ...item,
          label: activeChat?.muted || muteNotifications ? "Unmute notifications" : "Mute notifications",
        };
      }
      if ((item.id === "clear" || item.id === "delete") && chatListActionBusy) {
        return { ...item, disabled: true };
      }
      return item;
    });

  const activeChatImage = activeChat
    ? getCommAvatarSrc(activeChat.id, activeChat.avatarSrc)
    : userDummyImage;

  const chatAvatarSrc = (chat) =>
    getCommAvatarSrc(chat?.id, chat?.avatarSrc);

  const presenceClass = (chat) => {
    const status = resolvePresenceStatus(chat);
    if (status === "online") return "online";
    if (status === "away") return "away";
    return "";
  };

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Messages" pageTitle="Chat" />

          <div className="chat-wrapper d-lg-flex gap-1 mx-n4 mt-n4 p-1">
            <div className="chat-leftsidebar">
              <div className="px-4 pt-4 mb-3">
                <div className="d-flex align-items-start">
                  <div className="flex-grow-1">
                    <h5 className="mb-4">Chats</h5>
                  </div>
                  {canAdd ? (
                    <div className="flex-shrink-0">
                      <UncontrolledTooltip placement="bottom" target="addcontact">
                        New message
                      </UncontrolledTooltip>
                      <Button
                        color=""
                        id="addcontact"
                        className="btn btn-soft-success btn-sm shadow-none"
                        type="button"
                      >
                        <i className="ri-add-line align-bottom"></i>
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="search-box">
                  <input
                    type="text"
                    className="form-control bg-light border-light"
                    placeholder="Search here..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <i className="ri-search-2-line search-icon"></i>
                </div>
              </div>

              <Nav tabs className="nav nav-tabs nav-tabs-custom nav-success nav-justified mb-3">
                <NavItem>
                  <NavLink
                    style={{ cursor: "pointer" }}
                    className={classnames({ active: customActiveTab === "1" })}
                    onClick={() => toggleCustomTab(customActiveTab, "1", setCustomActiveTab)}
                  >
                    Chats
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    style={{ cursor: "pointer" }}
                    className={classnames({ active: customActiveTab === "2" })}
                    onClick={() => toggleCustomTab(customActiveTab, "2", setCustomActiveTab)}
                  >
                    Contacts
                  </NavLink>
                </NavItem>
              </Nav>

              <TabContent activeTab={customActiveTab} className="text-muted">
                <TabPane tabId="1" id="chats">
                  <SimpleBar className="chat-room-list pt-3" style={{ margin: "-16px 0px 0px" }}>
                    <div className="d-flex align-items-center px-4 mb-2">
                      <div className="flex-grow-1">
                        <h4 className="mb-0 fs-11 text-muted text-uppercase">
                          Direct Messages
                        </h4>
                      </div>
                    </div>

                    <div className="chat-message-list">
                      {usersLoading && (
                        <div className="text-center text-muted py-4 fs-13 px-3">
                          Loading users...
                        </div>
                      )}
                      {!usersLoading && usersError && (
                        <div className="text-center text-danger py-4 px-3 fs-13">
                          {usersError}
                        </div>
                      )}
                      {!usersLoading && !usersError && !filteredChats.length && (
                        <div className="text-center text-muted py-4 px-3 fs-13">
                          No users found
                        </div>
                      )}
                      <ul className="list-unstyled chat-list chat-user-list users-list" id="userList">
                        {!usersLoading &&
                          !usersError &&
                          filteredChats.map((chat) => (
                            <li
                              key={chat.id}
                              className={
                                String(activeChatId) === String(chat.id) ? "active" : ""
                              }
                            >
                              <Link
                                to="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  openChat(chat.id);
                                }}
                              >
                                <div className="d-flex align-items-center">
                                  <div
                                    className={classnames(
                                      "flex-shrink-0 chat-user-img align-self-center me-2 ms-0",
                                      chat.isSelf ? "online" : presenceClass(chat)
                                    )}
                                  >
                                    <div className="avatar-xs">
                                      <img
                                        src={chatAvatarSrc(chat)}
                                        className="rounded-circle img-fluid userprofile"
                                        alt=""
                                      />
                                    </div>
                                    <span className="user-status"></span>
                                  </div>
                                  <div className="flex-grow-1 overflow-hidden">
                                    <p className="text-truncate mb-0">{chat.name}</p>
                                    <p className="text-truncate mb-0 fs-12 text-muted chat-user-message">
                                      {typingPeerIds.has(String(chat.id)) &&
                                      !chat.isSelf ? (
                                        <span className="text-success">typing...</span>
                                      ) : (
                                        chat.preview
                                      )}
                                    </p>
                                  </div>
                                  <div className="flex-shrink-0 ms-2 text-end">
                                    {chat.time ? (
                                      <small className="text-muted d-block mb-1">{chat.time}</small>
                                    ) : null}
                                    {chat.unread > 0 ? (
                                      <span className="badge bg-success rounded-pill">
                                        {chat.unread}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </Link>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </SimpleBar>
                </TabPane>

                <TabPane tabId="2" id="contacts">
                  <SimpleBar className="chat-room-list pt-3" style={{ margin: "-16px 0px 0px" }}>
                    <div className="sort-contact">
                      {contactsByLetter.map((group) => (
                        <div className="mt-3" key={group.letter}>
                          <div className="contact-list-title">{group.letter}</div>
                          <ul className="list-unstyled contact-list">
                            {group.contacts.map((chat) => (
                              <li key={`contact-${chat.id}`}>
                                <div className="d-flex align-items-center">
                                  <div className="flex-shrink-0 me-2">
                                    <div className="avatar-xxs">
                                      <img
                                        src={chatAvatarSrc(chat)}
                                        className="img-fluid rounded-circle"
                                        alt=""
                                      />
                                    </div>
                                  </div>
                                  <div
                                    className="flex-grow-1"
                                    onClick={() => openChat(chat.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") openChat(chat.id);
                                    }}
                                  >
                                    <p className="text-truncate contactlist-name mb-0">
                                      {chat.name}
                                    </p>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </SimpleBar>
                </TabPane>
              </TabContent>
            </div>

            <div
              className={classnames("user-chat w-100 overflow-hidden", {
                "user-chat-show": Boolean(activeChat),
              })}
              ref={userChatShow}
            >
              {!activeChat ? (
                <div className="d-flex align-items-center justify-content-center comm-chat-welcome h-100 text-muted">
                  {usersLoading ? "Loading users..." : "Select a chat to start messaging"}
                </div>
              ) : (
                <div className="chat-content d-lg-flex">
                  <div className="w-100 overflow-hidden position-relative">
                    <div className="position-relative">
                      <div className="p-3 user-chat-topbar">
                        <Row className="align-items-center">
                          <Col sm={4} xs={8}>
                            <div className="d-flex align-items-center">
                              <div className="flex-shrink-0 d-block d-lg-none me-3">
                                <Link
                                  to="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    backToUserChat();
                                  }}
                                  className="user-chat-remove fs-18 p-1"
                                >
                                  <i className="ri-arrow-left-s-line align-bottom"></i>
                                </Link>
                              </div>
                              <div className="flex-grow-1 overflow-hidden">
                                <div className="d-flex align-items-center">
                                  <div
                                    className={classnames(
                                      "flex-shrink-0 chat-user-img user-own-img align-self-center me-3 ms-0",
                                      activeChat.isSelf ? "online" : presenceClass(activeChat)
                                    )}
                                  >
                                    <img
                                      src={activeChatImage}
                                      className="rounded-circle avatar-xs"
                                      alt=""
                                    />
                                    <span className="user-status"></span>
                                  </div>
                                  <div className="flex-grow-1 overflow-hidden">
                                    <h5 className="text-truncate mb-0 fs-16">
                                      <button
                                        type="button"
                                        className="text-reset username btn btn-link p-0 border-0 text-start"
                                        onClick={() => setShowContactPanel(true)}
                                      >
                                        {activeChat.name}
                                      </button>
                                    </h5>
                                    <p className="text-truncate text-muted fs-14 mb-0 userStatus">
                                      <small>
                                        {activeChat.isSelf
                                          ? "Message yourself"
                                          : peerIsTyping
                                            ? "typing..."
                                            : activePresenceStatus === "online"
                                              ? "Online"
                                              : "Offline"}
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
                                <Dropdown isOpen={search_Menu} toggle={() => setsearch_Menu(!search_Menu)}>
                                  <DropdownToggle className="btn btn-ghost-secondary btn-icon" tag="button">
                                    <FeatherIcon icon="search" className="icon-sm" />
                                  </DropdownToggle>
                                  <DropdownMenu className="p-0 dropdown-menu-end dropdown-menu-lg">
                                    <div className="p-2">
                                      <div className="search-box">
                                        <Input
                                          type="text"
                                          className="form-control bg-light border-light"
                                          placeholder="Search in chat..."
                                          value={chatSearchQuery}
                                          onChange={(e) => setChatSearchQuery(e.target.value)}
                                          innerRef={chatSearchInputRef}
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
                                  onClick={() => setShowContactPanel(true)}
                                >
                                  <FeatherIcon icon="info" className="icon-sm" />
                                </button>
                              </li>
                              <li className="list-inline-item m-0">
                                <Dropdown isOpen={settings_Menu} toggle={() => setsettings_Menu(!settings_Menu)}>
                                  <DropdownToggle className="btn btn-ghost-secondary btn-icon" tag="button">
                                    <FeatherIcon icon="more-vertical" className="icon-sm" />
                                  </DropdownToggle>
                                  <DropdownMenu className="dropdown-menu-end">
                                    {moreMenuItemsLive.map((item) =>
                                      item.type === "divider" ? (
                                        <DropdownItem divider key={item.id} />
                                      ) : (
                                        <DropdownItem
                                          key={item.id}
                                          href="#"
                                          disabled={Boolean(item.disabled)}
                                          className={item.danger ? "text-danger" : ""}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            if (item.disabled) return;
                                            handleMoreAction(item.id);
                                            setsettings_Menu(false);
                                          }}
                                        >
                                          <i className={`${item.icon} align-bottom text-muted me-2`}></i>
                                          {item.label}
                                        </DropdownItem>
                                      )
                                    )}
                                  </DropdownMenu>
                                </Dropdown>
                              </li>
                            </ul>
                          </Col>
                        </Row>
                      </div>

                      {selectMode && (
                        <div className="px-3 py-2 bg-light border-bottom d-flex align-items-center justify-content-between">
                          <span className="fs-13">{selectedMessageIds.length} selected</span>
                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              color="soft-success"
                              disabled={!selectedMessageIds.length}
                              onClick={() => {
                                const first = getActiveMessages().find((msg) =>
                                  selectedMessageIds.includes(msg.id)
                                );
                                if (!first) return;
                                openForwardModal(first);
                              }}
                            >
                              Forward
                            </Button>
                            {canDelete ? (
                              <Button
                                size="sm"
                                color="soft-danger"
                                disabled={!selectedMessageIds.length}
                                onClick={() => {
                                  const selected = getActiveMessages().filter(
                                    (msg) =>
                                      selectedMessageIds.includes(msg.id) &&
                                      !deletedForMeIds.has(String(msg.id))
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
                            ) : null}
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
                        <div className="chat-conversation" id="chat-conversation">
                          <div
                            className="chat-conversation-scroll"
                            ref={(el) => setMessageBox(el)}
                          >
                            {messagesLoading && (
                              <div className="text-center text-muted py-4 fs-13">
                                Loading messages...
                              </div>
                            )}
                            {!messagesLoading && messagesError && (
                              <div className="text-center text-danger py-3 px-3 fs-13">
                                {messagesError}
                              </div>
                            )}
                            {!messagesLoading && !messagesError && !visibleMessages.length && (
                              <div className="text-center text-muted py-4 fs-13">
                                {activeChat.isSelf
                                  ? "This is your space. Notes stay on this device."
                                  : "No messages yet."}
                              </div>
                            )}
                            <ul className="list-unstyled chat-conversation-list" id="users-conversation">
                              {visibleMessages.map((msg) =>
                                msg.isDateSeparator ? (
                                  <li key={msg.id} className="chat-list chat-day-separator">
                                    <div className="chat-day-chip">{msg.label}</div>
                                  </li>
                                ) : (
                                <li
                                  key={msg.id}
                                  id={`chat-msg-${msg.id}`}
                                  className={classnames(
                                    "chat-list",
                                    msg.from === "me" ? "right" : "left",
                                    {
                                      "is-focused-msg": focusMessageId === String(msg.id),
                                      selectable: selectMode,
                                      selected: selectedMessageIds.includes(msg.id),
                                    }
                                  )}
                                  onClick={() => {
                                    if (selectMode) toggleMessageSelect(msg.id);
                                  }}
                                >
                                  <div className="conversation-list">
                                    {msg.from !== "me" && (
                                      <div className="chat-avatar">
                                        <img src={activeChatImage} alt="" />
                                      </div>
                                    )}
                                    <div className="user-chat-content">
                                      {reactionPickerMsg &&
                                      String(reactionPickerMsg.id) === String(msg.id) ? (
                                        <div
                                          className="comm-reaction-emoji-picker"
                                          role="dialog"
                                          aria-label="More reactions"
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
                                      <div
                                        className={classnames("ctext-wrap", {
                                          "has-reaction": Boolean(msg.reaction),
                                        })}
                                      >
                                        <div className="ctext-wrap-content">
                                          {msg.forwarded ? (
                                            <small className="d-block text-muted mb-1 fs-11">
                                              <i className="ri-share-forward-line me-1"></i>
                                              Forwarded
                                            </small>
                                          ) : null}
                                          {msg.replyTo?.text || msg.parentMessageId ? (
                                            <div
                                              className="replymessage-block mb-2 replymessage-jump"
                                              role="button"
                                              tabIndex={0}
                                              title="Go to original message"
                                              onMouseDown={(e) => e.stopPropagation()}
                                              onClick={(e) => jumpToRepliedMessage(msg, e)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                  jumpToRepliedMessage(msg, e);
                                                }
                                              }}
                                            >
                                              <h5 className="conversation-name mb-1">
                                                {msg.replyTo?.name || "Contact"}
                                              </h5>
                                              <p className="mb-0 text-truncate">
                                                {msg.replyTo?.text || "Original message"}
                                              </p>
                                            </div>
                                          ) : null}
                                          {msg.type === "file" || msg.attachKind ? (
                                            <>
                                            {(() => {
                                              const attachPath = getMessageAttachmentPath(msg);
                                              const attachUrl = resolveChatAttachmentUrl(attachPath);
                                              const downloaded = isAttachmentDownloaded(msg);
                                              const attachKey = getAttachmentStorageKey(msg);
                                              const isDownloading =
                                                attachKey && downloadingAttachments.has(attachKey);
                                              const isPhoto =
                                                downloaded &&
                                                msg.mediaSubtype === "photo" &&
                                                Boolean(attachUrl);
                                              const isVideo =
                                                downloaded &&
                                                msg.mediaSubtype === "video" &&
                                                Boolean(attachUrl);

                                              const starBadge = msg.starred ? (
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
                                                        openChatAttachment(msg);
                                                      }}
                                                    >
                                                      <img
                                                        src={attachUrl}
                                                        alt={msg.fileName || "Photo"}
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
                                                        Your browser does not support video.
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
                                                      cursor: attachPath ? "pointer" : "default",
                                                    }}
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      if (isDownloading) return;
                                                      handleAttachmentClick(msg);
                                                    }}
                                                  >
                                                    <span className="avatar-xs flex-shrink-0">
                                                      <span className="avatar-title rounded bg-light text-body">
                                                        <i className={attachIconForMessage(msg)}></i>
                                                      </span>
                                                    </span>
                                                    <div className="overflow-hidden flex-grow-1">
                                                      <p className="mb-0 ctext-content text-truncate">
                                                        {msg.fileName || msg.text}
                                                      </p>
                                                      <small className="text-muted text-uppercase">
                                                        {msg.mediaSubtype === "video"
                                                          ? "Video"
                                                          : msg.mediaSubtype === "photo"
                                                            ? "Photo"
                                                            : msg.attachKind === "audio"
                                                              ? "Audio"
                                                              : "Document"}
                                                      </small>
                                                    </div>
                                                    {attachPath && !downloaded ? (
                                                      <span className="comm-attach-action flex-shrink-0">
                                                        {isDownloading ? (
                                                          <i
                                                            className="ri-loader-4-line text-muted spin-icon"
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
                                            })()}
                                            {msg.caption ? (
                                              <p className="mb-0 mt-2 ctext-content">
                                                {msg.caption}
                                              </p>
                                            ) : null}
                                            </>
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
                                            <DropdownToggle href="#" className="btn nav-btn" tag="a">
                                              <i className="ri-more-2-fill"></i>
                                            </DropdownToggle>
                                            <DropdownMenu className="dropdown-menu-end comm-msg-menu">
                                              <div
                                                className="comm-react-bar"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                {QUICK_REACTIONS.map(({ code, emoji }) => (
                                                  <button
                                                    key={code}
                                                    type="button"
                                                    className={classnames("comm-react-btn", {
                                                      active: msg.reactionCode === code,
                                                    })}
                                                    title={code}
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      toggleMessageReaction(msg, code);
                                                      document.body.click();
                                                    }}
                                                  >
                                                    {emoji}
                                                  </button>
                                                ))}
                                                <button
                                                  type="button"
                                                  className="comm-react-plus"
                                                  title="More reactions"
                                                  onClick={(e) => openReactionEmojiPicker(msg, e)}
                                                >
                                                  <i className="ri-add-line"></i>
                                                </button>
                                              </div>
                                              <div className="comm-msg-menu-panel">
                                                {messageActionItems
                                                  .filter((item) => {
                                                    if (item.id === "delete") return canDelete;
                                                    if (item.id === "download") {
                                                      return (
                                                        (msg.type === "file" || msg.attachKind) &&
                                                        Boolean(getMessageAttachmentPath(msg))
                                                      );
                                                    }
                                                    return item.type !== "divider";
                                                  })
                                                  .map((item) => (
                                                    <React.Fragment key={item.id}>
                                                      {item.id === "delete" ? (
                                                        <div className="dropdown-divider" />
                                                      ) : null}
                                                      <DropdownItem
                                                        href="#"
                                                        className={item.danger ? "text-danger" : ""}
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          handleMessageAction(item.id, msg);
                                                        }}
                                                      >
                                                        <i
                                                          className={`${item.icon} me-2 text-muted align-bottom`}
                                                        ></i>
                                                        {item.id === "star" && msg.starred
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
                                        <small className="text-muted time">{msg.time}</small>
                                        {msg.from === "me" && (
                                          <span className="text-success check-message-icon">
                                            {renderMessageTicks(msg)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </li>
                                )
                              )}
                            </ul>
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
                      </div>

                      {peerIsTyping ? (
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
                                  : activeChat.realName || activeChat.name}
                              </h5>
                              <p className="mb-0 text-truncate">
                                {replyTo.fileName || replyTo.text || ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-muted p-0 ms-2"
                              title="Cancel reply"
                              onClick={() => setReplyTo(null)}
                            >
                              <i className="bx bx-x fs-18 align-middle"></i>
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
                                    id="emoji-btn"
                                    onClick={() => setemojiPicker(!emojiPicker)}
                                  >
                                    <i className="bx bx-smile align-middle"></i>
                                  </button>
                                  {emojiPicker ? (
                                    <div className="comm-emoji-picker" role="dialog" aria-label="Emoji picker">
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
                                <div className="links-list-item position-relative" ref={attachMenuRef}>
                                  <button
                                    type="button"
                                    className="btn btn-link text-decoration-none"
                                    title="Attach"
                                    disabled={sending || uploading || messagesLoading}
                                    onClick={() => setShowAttachMenu((open) => !open)}
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
                                          <span className="comm-attach-label">{item.label}</span>
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
                                value={draft}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setDraft(value);
                                  notifyPeerTyping(Boolean(String(value).trim()));
                                }}
                                className="form-control chat-input bg-light border-light"
                                placeholder={
                                  replyTo
                                    ? "Type your reply..."
                                    : "Type your message..."
                                }
                                disabled={sending || messagesLoading}
                              />
                            </div>
                            <div className="col-auto">
                              <div className="chat-input-links ms-2">
                                <div className="links-list-item">
                                  <Button
                                    type="submit"
                                    color="primary"
                                    title="Send message"
                                    aria-label="Send message"
                                    disabled={!draft.trim() || sending || messagesLoading}
                                    className="chat-send waves-effect waves-light"
                                  >
                                    <i className="ri-send-plane-fill align-bottom"></i>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Row>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Container>
      </div>

      <PersonalInfo
        show={showContactPanel}
        onCloseClick={() => setShowContactPanel(false)}
        currentuser={activeChat?.name || ""}
        realName={activeChat?.realName || ""}
        cuurentiseImg={activeChat ? activeChatImage : undefined}
        phone={activeChat?.phone}
        email={activeChat?.email}
        location={activeChat?.location}
        jobTitle={activeChat?.jobTitle}
        department={activeChat?.department}
        statusLabel={
          activeChat?.isSelf
            ? "Message yourself"
            : activePresenceStatus === "online"
              ? "Online"
              : "Offline"
        }
        isSelf={Boolean(activeChat?.isSelf)}
        onAvatarChange={handleSelfAvatarChange}
        onProfileSave={handleSelfProfileSave}
        avatarSaving={avatarSaving}
        profileLoading={Boolean(activeChat?.isSelf && selfProfileLoading)}
        attachedFiles={attachedFiles}
        starredMessages={starredMessagesForContact}
        onOpenStarredMessage={(item) => {
          const messageId = item?.id || item?.message?.id;
          if (!messageId) return;
          setShowContactPanel(false);
          setFocusMessageId(String(messageId));
        }}
        onUnstarMessage={async (item) => {
          const msg = item?.message;
          if (!msg) return;
          await handleMessageAction("star", msg);
        }}
        onDownloadAttachment={(attachement) => {
          if (attachement?.message) {
            downloadChatAttachment(attachement.message);
            return;
          }
          if (attachement?.path) {
            downloadChatAttachment({
              attachmentPath1: attachement.path,
              fileName: attachement.foldername,
              id: attachement.id,
            });
          }
        }}
        downloadingAttachmentIds={downloadingAttachments}
      />

      <Modal
        isOpen={Boolean(pendingAttach)}
        toggle={() => {
          if (!uploading) clearPendingAttach();
        }}
        centered
        className="comm-attach-caption-modal"
      >
        <ModalHeader
          toggle={() => {
            if (!uploading) clearPendingAttach();
          }}
        >
          {pendingAttach?.kind === "media"
            ? "Send photo / video"
            : pendingAttach?.kind === "audio"
              ? "Send audio"
              : "Send document"}
        </ModalHeader>
        <ModalBody>
          {pendingAttach?.previewUrl &&
          String(pendingAttach.file?.type || "").startsWith("image/") ? (
            <>
              <div className="comm-attach-draw-toolbar mb-2">
                <button
                  type="button"
                  className={classnames("comm-attach-draw-tool", {
                    active: imageDrawMode,
                  })}
                  title="Draw"
                  aria-label="Draw"
                  disabled={uploading}
                  onClick={() => setImageDrawMode((v) => !v)}
                >
                  <i className="ri-pencil-fill"></i>
                </button>
                <button
                  type="button"
                  className="comm-attach-draw-tool"
                  title="Undo"
                  aria-label="Undo"
                  disabled={uploading || !drawStrokes.length}
                  onClick={() =>
                    setDrawStrokes((prev) => prev.slice(0, -1))
                  }
                >
                  <i className="ri-arrow-go-back-line"></i>
                </button>
                <button
                  type="button"
                  className="comm-attach-draw-tool"
                  title="Clear drawing"
                  aria-label="Clear drawing"
                  disabled={uploading || !drawStrokes.length}
                  onClick={() => setDrawStrokes([])}
                >
                  <i className="ri-close-circle-line"></i>
                </button>
              </div>
              <div className="comm-attach-caption-preview mb-2">
                <div className="comm-attach-draw-stage">
                  <img
                    ref={previewImgRef}
                    src={pendingAttach.previewUrl}
                    alt={pendingAttach.file?.name || "Preview"}
                    onLoad={syncAttachDrawCanvas}
                  />
                  <canvas
                    ref={drawCanvasRef}
                    className={classnames("comm-attach-draw-canvas", {
                      "is-drawing": imageDrawMode,
                    })}
                    onPointerDown={handleDrawPointerDown}
                    onPointerMove={handleDrawPointerMove}
                    onPointerUp={handleDrawPointerUp}
                    onPointerCancel={handleDrawPointerUp}
                    onPointerLeave={handleDrawPointerUp}
                  />
                </div>
              </div>
              {imageDrawMode ? (
                <div className="comm-attach-draw-colors mb-3">
                  {ATTACH_DRAW_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={classnames("comm-attach-draw-color", {
                        active: drawColor === color,
                      })}
                      style={{ backgroundColor: color }}
                      title={color}
                      aria-label={`Color ${color}`}
                      disabled={uploading}
                      onClick={() => setDrawColor(color)}
                    />
                  ))}
                </div>
              ) : (
                <div className="mb-3" />
              )}
            </>
          ) : pendingAttach?.previewUrl &&
            String(pendingAttach.file?.type || "").startsWith("video/") ? (
            <div className="comm-attach-caption-preview mb-3">
              <video
                src={pendingAttach.previewUrl}
                controls
                preload="metadata"
              />
            </div>
          ) : (
            <div className="comm-attach-caption-file mb-3">
              <i className={
                pendingAttach?.kind === "audio"
                  ? "ri-headphone-fill"
                  : "ri-file-text-fill"
              }></i>
              <div className="overflow-hidden">
                <p className="mb-0 text-truncate fw-medium">
                  {pendingAttach?.file?.name || "File"}
                </p>
                <small className="text-muted">
                  {pendingAttach?.file
                    ? `${Math.max(1, Math.round(pendingAttach.file.size / 1024))} KB`
                    : ""}
                </small>
              </div>
            </div>
          )}
          <Label className="form-label">Message</Label>
          <Input
            innerRef={attachCaptionRef}
            type="textarea"
            rows={3}
            value={attachCaption}
            disabled={uploading}
            placeholder="Add a message (optional)..."
            onChange={(e) => setAttachCaption(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendPendingAttach();
              }
            }}
          />
        </ModalBody>
        <ModalFooter>
          <Button
            color="light"
            disabled={uploading}
            onClick={clearPendingAttach}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            disabled={uploading || !pendingAttach}
            onClick={sendPendingAttach}
          >
            {uploading ? "Sending..." : "Send"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={Boolean(forwardMessage)}
        toggle={closeForwardModal}
        centered
        className="comm-forward-modal"
      >
        <ModalHeader toggle={closeForwardModal}>Forward message to</ModalHeader>
        <ModalBody>
          <div className="search-box mb-3">
            <Input
              type="text"
              className="form-control bg-light border-light"
              placeholder="Search chats..."
              value={forwardSearch}
              onChange={(e) => setForwardSearch(e.target.value)}
              disabled={forwarding}
            />
            <i className="ri-search-2-line search-icon"></i>
          </div>
          <SimpleBar style={{ maxHeight: "320px" }}>
            {forwardGroupsLoading && !forwardCandidates.length ? (
              <div className="text-center text-muted py-4 fs-13">Loading...</div>
            ) : !forwardCandidates.length ? (
              <div className="text-center text-muted py-4 fs-13">No chats found</div>
            ) : (
              <ul className="list-unstyled mb-0">
                {forwardCandidates.map((chat) => {
                  const key = chat.targetKey || String(chat.id);
                  const selected = forwardSelectedIds.includes(String(key));
                  const subtitle =
                    chat.targetType === "group"
                      ? "Group"
                      : chat.email && chat.email !== "—"
                        ? chat.email
                        : chat.role;
                  return (
                    <li
                      key={`forward-${key}`}
                      className={classnames(
                        "comm-forward-list-item d-flex align-items-center px-2 py-2 rounded",
                        { "is-selected": selected }
                      )}
                      onClick={() => toggleForwardTarget(key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleForwardTarget(key);
                        }
                      }}
                    >
                      <div className="flex-shrink-0 me-2">
                        <img
                          src={
                            chat.targetType === "group"
                              ? chat.avatarSrc ||
                                getCommAvatarSrc(chat.groupId)
                              : chatAvatarSrc(chat)
                          }
                          alt=""
                          className="rounded-circle avatar-xs"
                        />
                      </div>
                      <div className="flex-grow-1 overflow-hidden">
                        <p className="mb-0 text-truncate">
                          {chat.name}
                          {chat.targetType === "group" ? (
                            <span className="badge bg-soft-primary text-primary ms-2 fs-11">
                              Group
                            </span>
                          ) : null}
                        </p>
                        <p className="mb-0 fs-12 text-muted text-truncate">
                          {subtitle}
                        </p>
                      </div>
                      <FormGroup check className="flex-shrink-0 mb-0">
                        <Input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleForwardTarget(key)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={forwarding}
                        />
                        <Label check className="visually-hidden">
                          Select {chat.name}
                        </Label>
                      </FormGroup>
                    </li>
                  );
                })}
              </ul>
            )}
          </SimpleBar>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={closeForwardModal} disabled={forwarding}>
            Cancel
          </Button>
          <Button
            color="success"
            onClick={confirmForwardMessages}
            disabled={!forwardSelectedIds.length || forwarding}
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
          reactionDetailsMsg?.from === "me"
            ? activeChatId
            : reactionDetailsMsg?.senderUserId || activeChatId
        }
        resolveUser={(userId) => {
          const id = String(userId);
          if (id === String(me?.userId ?? "")) {
            const selfChat = chatList.find((c) => c.isSelf);
            return {
              name: "You",
              email: me?.email,
              avatarSrc:
                selfChat?.avatarSrc ||
                selfChat?.img ||
                resolveUserAvatarUrl(me?.userId, me?.profileImage),
            };
          }
          const chat = chatList.find((c) => String(c.id) === id);
          if (chat) {
            return {
              name: chat.realName || chat.name,
              email: chat.email,
              avatarSrc: chat.avatarSrc || chat.img,
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
            toggleMessageReaction(reactionDetailsMsg, code);
          }
          setReactionDetailsMsg(null);
        }}
      />

      {actionToast ? (
        <div className="alert alert-dark comm-action-toast shadow">{actionToast}</div>
      ) : null}
    </React.Fragment>
  );
};

export default Messages;

