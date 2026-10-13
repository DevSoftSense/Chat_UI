import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import classnames from "classnames";
import SimpleBar from "simplebar-react";
import Select, { components as selectComponents } from "react-select";
import {
  Alert,
  Col,
  Container,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Nav,
  NavItem,
  NavLink,
  Row,
  Spinner,
  TabContent,
  TabPane,
  UncontrolledDropdown,
} from "reactstrap";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import { getCommAvatarSrc } from "../components/CommAvatar";
import { formatMessageInfoWhen } from "../Groups/MessageInfo";
import {
  IMAGE_EXTS,
  VIDEO_EXTS,
  attachIconForMessage,
  cleanAttachmentDisplayName,
  fileExt,
  resolveAttachMeta,
} from "../Messages/MessageAttachments";
import {
  canUseAllUserCommunication,
  getConfiguredProductId,
  getOrganisationProductUsers,
  getPrivateChatMessagesBetweenUsers,
  getSessionPublicOrgId,
  getSessionUserIdentity,
  isCommFromEligibleTokens,
  persistSessionUserType,
  persistSessionCommRoles,
  pickProductUserType,
  pickProductCommEligibilityTokens,
  getAllUserCommunicationRequiredUserTypes,
  resolveUserAvatarUrl,
  subscribeChatPresence,
  joinCommObserverWatch,
  leaveCommObserverWatch,
  getChatDateFormat,
  formatDateByPreference,
  resolveChatAttachmentUrl,
  fetchChatAttachmentBlob,
  getChatMessageInfo,
} from "../../../helpers/softoncloud_auth_helper";
import {
  AucGroupChatTopbar,
  AucGroupInfoModal,
  AucGroupsSidebarTab,
  formatGroupMsgTime,
  useAucGroups,
  useAucGroupThread,
} from "./grups";
import "../Messages/messages.scss";

/** Same SoftOnCloud avatar fields as Messages list. */
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

const unwrapUsers = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.users)) return response.users;
  return [];
};

const userSelectLabel = (user) =>
  user.realName || user.name || "User";

const toUserSelectOption = (user) => ({
  value: String(user.id),
  label: userSelectLabel(user),
  avatarSrc: getCommAvatarSrc(user.id, user.avatarSrc),
  userType: user.userType || null,
  realName: user.realName || user.name,
});

const UserSelectOption = (props) => {
  const { data } = props;
  const src = getCommAvatarSrc(data.value, data.avatarSrc);
  return (
    <selectComponents.Option {...props}>
      <div className="d-flex align-items-center gap-2">
        <img
          src={src}
          alt=""
          className="rounded-circle flex-shrink-0"
          style={{ width: 24, height: 24, objectFit: "cover" }}
        />
        <span className="text-truncate">{data.label}</span>
      </div>
    </selectComponents.Option>
  );
};

const UserSelectSingleValue = (props) => {
  const { data } = props;
  const src = getCommAvatarSrc(data.value, data.avatarSrc);
  return (
    <selectComponents.SingleValue {...props}>
      <div className="d-flex align-items-center gap-2">
        <img
          src={src}
          alt=""
          className="rounded-circle flex-shrink-0"
          style={{ width: 22, height: 22, objectFit: "cover" }}
        />
        <span className="text-truncate">{data.label}</span>
      </div>
    </selectComponents.SingleValue>
  );
};

const isAucDarkMode = () => {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  return (
    root.getAttribute("data-bs-theme") === "dark" ||
    root.getAttribute("data-layout-mode") === "dark" ||
    document.body?.getAttribute("data-layout-mode") === "dark"
  );
};

const getAucSelectThemeColors = () => {
  const dark = isAucDarkMode();
  if (dark) {
    return {
      controlBg: "var(--vz-input-bg, #212529)",
      controlBorder: "var(--vz-input-border, #32383e)",
      controlColor: "var(--vz-body-color, #e9ebec)",
      menuBg: "var(--vz-secondary-bg, #212529)",
      menuBorder: "var(--vz-border-color, #32383e)",
      optionHover: "var(--vz-tertiary-bg, #2a2f34)",
      optionSelected: "rgba(var(--vz-primary-rgb, 64, 81, 137), 0.35)",
      placeholder: "var(--vz-secondary-color, #878a99)",
      indicator: "var(--vz-secondary-color, #878a99)",
    };
  }
  return {
    controlBg: "var(--vz-input-bg, #fff)",
    controlBorder: "var(--vz-input-border, #ced4da)",
    controlColor: "var(--vz-body-color, #212529)",
    menuBg: "var(--vz-secondary-bg, #fff)",
    menuBorder: "var(--vz-border-color, #e9ebec)",
    optionHover: "var(--vz-tertiary-bg, #f3f6f9)",
    optionSelected: "rgba(var(--vz-primary-rgb, 64, 81, 137), 0.12)",
    placeholder: "var(--vz-secondary-color, #878a99)",
    indicator: "var(--vz-secondary-color, #878a99)",
  };
};

const buildAucUserSelectStyles = () => {
  const c = getAucSelectThemeColors();
  return {
    control: (base, state) => ({
      ...base,
      minHeight: 34,
      fontSize: 13,
      backgroundColor: c.controlBg,
      borderColor: state.isFocused ? "var(--vz-primary, #405189)" : c.controlBorder,
      boxShadow: state.isFocused
        ? "0 0 0 0.15rem rgba(var(--vz-primary-rgb, 64, 81, 137), 0.25)"
        : "none",
      color: c.controlColor,
      "&:hover": {
        borderColor: state.isFocused
          ? "var(--vz-primary, #405189)"
          : c.controlBorder,
      },
    }),
    valueContainer: (base) => ({
      ...base,
      paddingTop: 2,
      paddingBottom: 2,
      color: c.controlColor,
    }),
    singleValue: (base) => ({
      ...base,
      color: c.controlColor,
      maxWidth: "100%",
    }),
    input: (base) => ({
      ...base,
      color: c.controlColor,
    }),
    placeholder: (base) => ({
      ...base,
      color: c.placeholder,
    }),
    indicatorsContainer: (base) => ({
      ...base,
      height: 32,
      color: c.indicator,
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: c.indicator,
      "&:hover": { color: c.controlColor },
    }),
    clearIndicator: (base) => ({
      ...base,
      color: c.indicator,
      "&:hover": { color: c.controlColor },
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: c.controlBorder,
    }),
    menu: (base) => ({
      ...base,
      zIndex: 20,
      backgroundColor: c.menuBg,
      border: `1px solid ${c.menuBorder}`,
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    }),
    menuList: (base) => ({
      ...base,
      backgroundColor: c.menuBg,
      padding: 4,
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? c.optionSelected
        : state.isFocused
          ? c.optionHover
          : "transparent",
      color: c.controlColor,
      cursor: "pointer",
      "&:active": {
        backgroundColor: c.optionSelected,
      },
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: c.placeholder,
    }),
  };
};

const UserAvatarSelect = ({
  id,
  value,
  options,
  placeholder,
  onChange,
  isDisabled = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(isAucDarkMode);
  const selected =
    value != null && String(value) !== ""
      ? options.find((o) => String(o.value) === String(value)) || null
      : null;

  useEffect(() => {
    const sync = () => setDarkMode(isAucDarkMode());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-bs-theme", "data-layout-mode", "class"],
    });
    if (document.body) {
      obs.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-layout-mode", "class"],
      });
    }
    return () => obs.disconnect();
  }, []);

  const selectStyles = useMemo(
    () => buildAucUserSelectStyles(),
    [darkMode]
  );

  return (
    <Select
      inputId={id}
      classNamePrefix="auc-user-select"
      className="auc-user-select-root"
      options={options}
      value={selected}
      onChange={(opt, meta) => {
        const next = opt?.value != null ? String(opt.value) : "";
        onChange(next);
        // Clear (×) → empty + reopen dropdown (after clear's default menu close)
        if (meta?.action === "clear") {
          window.setTimeout(() => setMenuOpen(true), 0);
          return;
        }
        if (meta?.action === "select-option") {
          setMenuOpen(false);
        }
      }}
      menuIsOpen={menuOpen}
      onMenuOpen={() => setMenuOpen(true)}
      onMenuClose={() => setMenuOpen(false)}
      openMenuOnFocus
      openMenuOnClick
      placeholder={placeholder}
      isClearable
      isDisabled={isDisabled}
      blurInputOnSelect
      components={{
        Option: UserSelectOption,
        SingleValue: UserSelectSingleValue,
      }}
      styles={selectStyles}
    />
  );
};

const displayNameOf = (user) =>
  user.displayName ||
  user.DisplayName ||
  [user.firstName || user.FirstName, user.lastName || user.LastName]
    .filter(Boolean)
    .join(" ") ||
  user.email ||
  user.Email ||
  `User ${user.userId || user.UserId}`;

const userIdOf = (user) => Number(user.userId ?? user.UserId ?? 0);

const formatMsgTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/** WhatsApp-style day chip: Today / Yesterday / formatted date */
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
  if (!msg?.sentAt) return "";
  const date = new Date(msg.sentAt);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const withDateSeparators = (list, dateFormat = getChatDateFormat()) => {
  const rows = [];
  let lastKey = "";
  (list || []).forEach((msg) => {
    const key = getMessageDayKey(msg);
    if (key && key !== lastKey) {
      rows.push({
        id: `day-${key}`,
        isDateSeparator: true,
        label: formatChatDayLabel(msg.sentAt, dateFormat),
      });
      lastKey = key;
    }
    rows.push(msg);
  });
  return rows;
};

const toggleCustomTab = (current, tab, setter) => {
  if (current !== tab) setter(tab);
};

const formatPresenceLabel = (presence, isSelf = false) => {
  if (isSelf) return "Online";
  if (!presence?.status) return "Offline";
  const t = presence.changedAt ? formatMsgTime(presence.changedAt) : "";
  if (presence.status === "online") {
    return t ? `Online · ${t}` : "Online";
  }
  return t ? `Offline · ${t}` : "Offline";
};

const mapApiUserToRow = (user, me) => {
  const id = userIdOf(user);
  const self =
    me?.userId != null && String(id) === String(me.userId)
      ? true
      : me?.email &&
        String(user.email || user.Email || "")
          .trim()
          .toLowerCase() === String(me.email).trim().toLowerCase();
  const name = self ? "You" : displayNameOf(user);
  const type = pickProductUserType(user);
  const apiAvatar = self
    ? pickUserAvatar(user) || me?.profileImage || null
    : pickUserAvatar(user);
  const resolved = resolveUserAvatarUrl(id, apiAvatar);

  return {
    id: String(id),
    name,
    realName: displayNameOf(user),
    isSelf: Boolean(self),
    userType: type || null,
    email: user.email || user.Email || "",
    // Same fallback avatars as Messages / CommAvatar when SoftOnCloud has no photo
    avatarSrc: getCommAvatarSrc(id, resolved),
    preview: "",
    time: "",
  };
};

const mapMessageRow = (
  msg,
  fromUserId,
  userNameById,
  userTypeById = new Map(),
  userAvatarById = new Map()
) => {
  const senderId = Number(msg?.senderUserId ?? msg?.SenderUserId ?? 0);
  const receiverId = Number(msg?.receiverUserId ?? msg?.ReceiverUserId ?? 0);
  const sentAt =
    msg?.sentAt ??
    msg?.SentAt ??
    msg?.createdAt ??
    msg?.CreatedAt ??
    null;
  const readAt = msg?.readAt ?? msg?.ReadAt ?? null;
  const deletedAt = msg?.deletedAt ?? msg?.DeletedAt ?? null;
  const deletedBy = Number(msg?.deletedBy ?? msg?.DeletedBy ?? 0) || null;
  const parentMessageId = msg?.parentMessageId ?? msg?.ParentMessageId ?? null;
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
  const receiverName =
    userNameById.get(String(receiverId)) || `User ${receiverId || "?"}`;
  const senderType = userTypeById.get(String(senderId)) || null;
  const receiverType = userTypeById.get(String(receiverId)) || null;
  const senderAvatarSrc = getCommAvatarSrc(
    senderId,
    userAvatarById.get(String(senderId)) || null
  );

  let status = "Delivered";
  if (readAt) status = "Seen";

  return {
    id: String(msg?.messageId ?? msg?.MessageId ?? `${senderId}-${sentAt}`),
    senderId,
    receiverId,
    senderName,
    receiverName,
    senderType,
    receiverType,
    senderAvatarSrc,
    text,
    time: formatMsgTime(sentAt),
    sentAt,
    parentMessageId,
    status,
    side: senderId === Number(fromUserId) ? "from" : "to",
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
  };
};

const previewFromMessages = (rows, fromUserId, toUserId, userNameById) => {
  const last = rows[rows.length - 1];
  if (!last) return null;
  const row = mapMessageRow(last, fromUserId, userNameById);
  if (!row.text) return null;
  return {
    preview: `${row.senderName}: ${row.text}`,
    time: row.time,
    pairKey: `${fromUserId}:${toUserId}`,
  };
};

/** Image/video preview via authenticated blob (shows JPG/PNG immediately). */
const AucMediaPreview = ({ path, fileName, kind, onOpen, onDownload, downloading }) => {
  const [src, setSrc] = useState(() => resolveChatAttachmentUrl(path));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false;
    let objectUrl = null;
    setFailed(false);
    setSrc(resolveChatAttachmentUrl(path));

    (async () => {
      try {
        const blob = await fetchChatAttachmentBlob(path);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        /* keep static URL fallback */
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!path || failed || !src) {
    return (
      <div
        className="d-flex align-items-center gap-2 text-start comm-attach-card"
        role="button"
        onClick={(e) => {
          e.preventDefault();
          if (!downloading) onDownload?.();
        }}
      >
        <span className="avatar-xs flex-shrink-0">
          <span className="avatar-title rounded bg-light text-body">
            <i className={kind === "video" ? "ri-video-fill" : "ri-image-fill"}></i>
          </span>
        </span>
        <div className="overflow-hidden flex-grow-1">
          <p className="mb-0 ctext-content text-truncate">
            {fileName || "Media"}
          </p>
          <small className="text-muted text-uppercase">
            {kind === "video" ? "Video" : "Photo"}
          </small>
        </div>
        <span className="comm-attach-action flex-shrink-0">
          {downloading ? (
            <i className="ri-loader-4-line text-muted spin-icon"></i>
          ) : (
            <i className="ri-download-2-line text-muted" title="Download"></i>
          )}
        </span>
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className="comm-media-preview flex-grow-1">
        <video
          src={src}
          controls
          className="comm-media-preview-video"
          preload="metadata"
          onError={() => setFailed(true)}
        >
          Your browser does not support video.
        </video>
        <button
          type="button"
          className="btn btn-sm btn-soft-primary mt-1"
          disabled={downloading}
          onClick={(e) => {
            e.preventDefault();
            onDownload?.();
          }}
        >
          {downloading ? (
            <Spinner size="sm" />
          ) : (
            <>
              <i className="ri-download-2-line me-1"></i>
              Download
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column align-items-stretch gap-1">
      <div
        className="comm-media-preview flex-grow-1"
        role="button"
        title="Open photo"
        onClick={(e) => {
          e.preventDefault();
          onOpen?.(src);
        }}
      >
        <img
          src={src}
          alt={fileName || "Photo"}
          className="comm-media-preview-img"
          onError={() => setFailed(true)}
        />
      </div>
      <button
        type="button"
        className="btn btn-sm btn-soft-primary align-self-start"
        disabled={downloading}
        onClick={(e) => {
          e.preventDefault();
          onDownload?.();
        }}
      >
        {downloading ? (
          <Spinner size="sm" />
        ) : (
          <>
            <i className="ri-download-2-line me-1"></i>
            Download
          </>
        )}
      </button>
    </div>
  );
};

/**
 * PRIME views any user's conversation: pick From + To, GET messages between them.
 * Example: From=Kenil, To=demo user 1 → shows Kenil ↔ demo user 1 chat.
 */
const AllUserCommunication = () => {
  const me = useMemo(() => getSessionUserIdentity(), []);
  const myUserId = Number(me?.userId) || 0;
  const [allowed, setAllowed] = useState(() => canUseAllUserCommunication(me));

  const [loading, setLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [customActiveTab, setCustomActiveTab] = useState("1");
  const [activeGroupId, setActiveGroupId] = useState("");
  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [threads, setThreads] = useState({});
  const [threadLoading, setThreadLoading] = useState(false);
  const [sendError, setSendError] = useState("");
  const [downloadingIds, setDownloadingIds] = useState(() => new Set());
  const [infoMsg, setInfoMsg] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoExtra, setInfoExtra] = useState(null);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  /** { [userId]: { status: 'online'|'offline', changedAt: ISO string } } */
  const [presenceByUserId, setPresenceByUserId] = useState({});
  const userChatShow = useRef(null);
  const scrollRef = useRef(null);
  const usersRef = useRef([]);
  const fromUserIdRef = useRef("");
  const toUserIdRef = useRef("");
  const loadSeqRef = useRef(0);

  useEffect(() => {
    fromUserIdRef.current = fromUserId;
    toUserIdRef.current = toUserId;
  }, [fromUserId, toUserId]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const userNameById = useMemo(() => {
    const map = new Map();
    users.forEach((u) => {
      map.set(String(u.id), u.realName || u.name);
    });
    return map;
  }, [users]);

  const pairKey =
    fromUserId && toUserId && fromUserId !== toUserId
      ? `${fromUserId}:${toUserId}`
      : null;

  const activeMessages = pairKey ? threads[pairKey] || [] : [];
  const visibleMessages = useMemo(
    () => withDateSeparators(activeMessages),
    [activeMessages]
  );

  const fromUser = useMemo(
    () => users.find((u) => String(u.id) === String(fromUserId)) || null,
    [users, fromUserId]
  );

  const toUser = useMemo(
    () => users.find((u) => String(u.id) === String(toUserId)) || null,
    [users, toUserId]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (c) =>
        String(c.name || "").toLowerCase().includes(q) ||
        String(c.realName || "").toLowerCase().includes(q) ||
        String(c.email || "").toLowerCase().includes(q) ||
        String(c.userType || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  const {
    groups,
    groupsLoading,
    groupsError,
    filteredGroups,
    setGroups,
  } = useAucGroups(allowed, search);

  const activeGroup = useMemo(
    () =>
      groups.find((g) => String(g.groupId) === String(activeGroupId)) ||
      groups.find((g) => String(g.id) === String(activeGroupId)) ||
      null,
    [groups, activeGroupId]
  );

  const isGroupView = customActiveTab === "2" && Boolean(activeGroup);

  const {
    groupMessages,
    groupLoading,
    groupError,
    loadGroupConversation,
    appendGroupMessage,
    markGroupMessageDeleted,
  } = useAucGroupThread({
    activeGroup: isGroupView ? activeGroup : null,
    allowed,
    users,
    myUserId,
    scrollToBottom,
  });

  const visibleGroupMessages = useMemo(
    () => withDateSeparators(groupMessages),
    [groupMessages]
  );

  const toSelectOptions = useMemo(
    () =>
      users
        .filter((u) => String(u.id) !== String(fromUserId))
        .map(toUserSelectOption),
    [users, fromUserId]
  );

  const fromSelectOptions = useMemo(
    () =>
      users
        .filter((u) => String(u.id) !== String(toUserId))
        .map(toUserSelectOption),
    [users, toUserId]
  );

  const loadConversation = useCallback(
    async (fromId, toId, { silent = false } = {}) => {
      const fromNum = Number(fromId);
      const toNum = Number(toId);
      if (
        !Number.isFinite(fromNum) ||
        fromNum <= 0 ||
        !Number.isFinite(toNum) ||
        toNum <= 0 ||
        fromNum === toNum
      ) {
        return [];
      }

      const key = `${fromNum}:${toNum}`;
      const seq = ++loadSeqRef.current;
      if (!silent) setThreadLoading(true);
      setSendError("");

      try {
        const rows = await getPrivateChatMessagesBetweenUsers(fromNum, toNum);
        if (seq !== loadSeqRef.current) return [];

        const nameMap = new Map(
          usersRef.current.map((u) => [String(u.id), u.realName || u.name])
        );
        const typeMap = new Map(
          usersRef.current
            .filter((u) => u.userType)
            .map((u) => [String(u.id), u.userType])
        );
        const avatarMap = new Map(
          usersRef.current.map((u) => [String(u.id), u.avatarSrc || null])
        );
        const mapped = (rows || [])
          .map((m) =>
            mapMessageRow(m, fromNum, nameMap, typeMap, avatarMap)
          )
          .filter((m) => m.text || m.attachmentPath1 || m.type === "file");

        let shouldScroll = !silent;
        setThreads((prev) => {
          const prevList = prev[key] || [];
          const prevLast = prevList[prevList.length - 1]?.id;
          const nextLast = mapped[mapped.length - 1]?.id;
          if (
            silent &&
            (mapped.length > prevList.length ||
              String(prevLast || "") !== String(nextLast || ""))
          ) {
            shouldScroll = true;
          }
          return { ...prev, [key]: mapped };
        });

        const preview = previewFromMessages(
          mapped,
          fromNum,
          toNum,
          nameMap
        );
        if (preview) {
          setUsers((prev) =>
            prev.map((u) =>
              String(u.id) === String(toNum)
                ? {
                    ...u,
                    preview: preview.preview,
                    time: preview.time || u.time,
                  }
                : u
            )
          );
        }

        if (shouldScroll) setTimeout(scrollToBottom, 50);
        return mapped;
      } catch (err) {
        if (seq === loadSeqRef.current && !silent) {
          const status = err?.status;
          let message = err?.message || "Failed to load messages.";
          if (status === 404) {
            message =
              "Chat API route not found (404). Restart local Chat API (https://localhost:7008) with latest code.";
          } else if (status === 403) {
            message =
              "Not allowed to view this pair (403). Login as PRIME / eligible userType.";
          }
          setSendError(message);
          setThreads((prev) => ({ ...prev, [key]: [] }));
        }
        return [];
      } finally {
        if (seq === loadSeqRef.current && !silent) {
          setThreadLoading(false);
        }
      }
    },
    [scrollToBottom]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setUsersError("");
      try {
        const orgId = getSessionPublicOrgId();
        const productId = getConfiguredProductId();
        if (!orgId) throw new Error("Organisation ID missing. Please sign in again.");
        if (!productId) throw new Error("Product ID is not configured.");

        const response = await getOrganisationProductUsers(orgId, productId);
        if (cancelled) return;

        const rows = unwrapUsers(response).filter(Boolean);
        const mapped = rows
          .map((u) => mapApiUserToRow(u, me))
          .filter((u) => u.id && u.id !== "0");

        const meRow = mapped.find((c) => c.isSelf);
        const meApiRow = rows.find((u) => {
          const id = Number(u?.userId ?? u?.UserId ?? 0);
          return (
            (me?.userId != null &&
              id > 0 &&
              String(id) === String(me.userId)) ||
            (me?.email &&
              String(u?.email || u?.Email || "")
                .trim()
                .toLowerCase() === String(me.email).trim().toLowerCase())
          );
        });
        const effectiveType =
          pickProductUserType(meApiRow) ||
          me?.userType ||
          me?.identityType ||
          meRow?.userType ||
          "";

        if (effectiveType) {
          persistSessionUserType(effectiveType);
        }
        if (meApiRow) {
          persistSessionCommRoles(
            meApiRow?.roleNames ?? meApiRow?.RoleNames ?? [],
            meApiRow?.roleCodes ?? meApiRow?.RoleCodes ?? []
          );
        }

        // userType OR SoftOnCloud roleNames (e.g. Admin) vs AllUserCommunicationUserType
        const requiredTypes = await getAllUserCommunicationRequiredUserTypes({
          forceRefresh: true,
        });
        const eligibilityTokens = meApiRow
          ? pickProductCommEligibilityTokens(meApiRow)
          : [
              effectiveType,
              ...(me?.roleNames || []),
              ...(me?.roleCodes || []),
            ].filter(Boolean);
        const isAllowed = isCommFromEligibleTokens(
          eligibilityTokens,
          requiredTypes
        );
        setAllowed(isAllowed);

        if (!isAllowed) {
          setUsers([]);
          return;
        }

        let list = mapped;
        if (!list.some((c) => c.isSelf) && myUserId > 0) {
          list = [
            {
              id: String(myUserId),
              name: "You",
              realName: me.displayName || me.email || "You",
              isSelf: true,
              userType: effectiveType || null,
              email: me.email || "",
              avatarSrc: getCommAvatarSrc(
                myUserId,
                resolveUserAvatarUrl(myUserId, me.profileImage)
              ),
              preview: "",
              time: "",
            },
            ...list,
          ];
        }

        if (myUserId > 0) {
          setPresenceByUserId((prev) => ({
            ...prev,
            [String(myUserId)]: {
              status: "online",
              changedAt: new Date().toISOString(),
            },
          }));
        }

        // Ensure every row has a visible DP (API photo or project default avatar)
        list = list.map((u) => ({
          ...u,
          avatarSrc: getCommAvatarSrc(u.id, u.avatarSrc),
        }));

        setUsers(list);

        if (myUserId > 0) {
          setFromUserId(String(myUserId));
        }
      } catch (err) {
        if (!cancelled) {
          setUsersError(err?.message || "Failed to load users.");
          setUsers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, myUserId]);

  useEffect(() => {
    if (!pairKey || isGroupView) return undefined;
    userChatShow.current?.classList.add("user-chat-show");
    loadConversation(fromUserId, toUserId);
    return () => {
      loadSeqRef.current += 1;
    };
  }, [pairKey, fromUserId, toUserId, loadConversation, isGroupView]);

  useEffect(() => {
    if (!myUserId) return undefined;

    const markPresence = (ids, status) => {
      const now = new Date().toISOString();
      const idList = (Array.isArray(ids) ? ids : [ids])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean);
      if (!idList.length) return;
      setPresenceByUserId((prev) => {
        const next = { ...prev };
        idList.forEach((id) => {
          next[id] = { status, changedAt: now };
        });
        return next;
      });
    };

    return subscribeChatPresence((event, payload) => {
      if (event === "OnlineUsers") {
        const ids = Array.isArray(payload)
          ? payload.map((id) => String(id))
          : [];
        const now = new Date().toISOString();
        setPresenceByUserId((prev) => {
          const next = { ...prev };
          // Snapshot: mark listed users online; keep prior offline timestamps
          Object.keys(next).forEach((id) => {
            if (!ids.includes(id) && next[id]?.status === "online") {
              next[id] = { status: "offline", changedAt: now };
            }
          });
          ids.forEach((id) => {
            if (next[id]?.status === "online") return;
            next[id] = { status: "online", changedAt: now };
          });
          return next;
        });
        return;
      }

      if (event === "UserOnline") {
        markPresence(payload, "online");
        return;
      }

      if (event === "UserOffline") {
        markPresence(payload, "offline");
        return;
      }

      if (event === "MessageDeleted") {
        const messageId = String(
          payload?.messageId ?? payload?.MessageId ?? ""
        );
        if (!messageId) return;
        const deletedAt =
          payload?.deletedAt ?? payload?.DeletedAt ?? new Date().toISOString();
        const deletedBy = Number(
          payload?.deletedBy ?? payload?.DeletedBy ?? 0
        ) || null;
        const deletedByName = deletedBy
          ? usersRef.current.find((u) => String(u.id) === String(deletedBy))
              ?.realName ||
            usersRef.current.find((u) => String(u.id) === String(deletedBy))
              ?.name ||
            `User ${deletedBy}`
          : null;
        setThreads((prev) => {
          const next = { ...prev };
          let changed = false;
          Object.keys(next).forEach((key) => {
            const list = next[key] || [];
            const idx = list.findIndex((m) => String(m.id) === messageId);
            if (idx < 0) return;
            changed = true;
            const copy = [...list];
            copy[idx] = {
              ...copy[idx],
              deletedAt,
              deletedBy,
              deletedByName,
              text: copy[idx].text || "This message was deleted",
            };
            next[key] = copy;
          });
          return changed ? next : prev;
        });
        markGroupMessageDeleted(messageId, payload, usersRef);
        setInfoMsg((prev) =>
          prev && String(prev.id) === messageId
            ? { ...prev, deletedAt, deletedBy, deletedByName }
            : prev
        );
        return;
      }

      if (event !== "ReceiveMessage" || !payload) return;
      const groupId = payload.groupId ?? payload.GroupId;
      if (groupId != null && groupId !== "") {
        const body = String(
          payload.messageBody ?? payload.MessageBody ?? ""
        ).trim();
        const sentAt =
          payload.sentAt ?? payload.SentAt ?? payload.createdAt ?? null;
        setGroups((prev) =>
          prev.map((g) =>
            String(g.groupId) === String(groupId)
              ? {
                  ...g,
                  preview: body || g.preview || "",
                  time: sentAt ? formatGroupMsgTime(sentAt) : g.time,
                }
              : g
          )
        );
        appendGroupMessage(payload, usersRef);
        return;
      }

      const senderId = String(
        payload.senderUserId ?? payload.SenderUserId ?? ""
      );
      const receiverId = String(
        payload.receiverUserId ?? payload.ReceiverUserId ?? ""
      );
      const fromId = fromUserIdRef.current;
      const toId = toUserIdRef.current;
      if (!fromId || !toId || fromId === toId) return;

      const matchesPair =
        (senderId === fromId && receiverId === toId) ||
        (senderId === toId && receiverId === fromId);
      if (!matchesPair) return;

      const nameMap = new Map(
        usersRef.current.map((u) => [String(u.id), u.realName || u.name])
      );
      const typeMap = new Map(
        usersRef.current
          .filter((u) => u.userType)
          .map((u) => [String(u.id), u.userType])
      );
      const avatarMap = new Map(
        usersRef.current.map((u) => [String(u.id), u.avatarSrc || null])
      );
      const uiMsg = mapMessageRow(
        payload,
        Number(fromId),
        nameMap,
        typeMap,
        avatarMap
      );
      if (!uiMsg.text && !uiMsg.attachmentPath1) return;

      const key = `${fromId}:${toId}`;
      setThreads((prev) => {
        const list = prev[key] || [];
        if (list.some((m) => String(m.id) === String(uiMsg.id))) return prev;
        return { ...prev, [key]: [...list, uiMsg] };
      });

      setTimeout(scrollToBottom, 50);
    });
  }, [
    myUserId,
    scrollToBottom,
    appendGroupMessage,
    markGroupMessageDeleted,
    setGroups,
  ]);

  // SignalR: join org observer room (not polling). Groups membership unchanged.
  useEffect(() => {
    if (!allowed) return undefined;
    let cancelled = false;
    const join = async () => {
      await joinCommObserverWatch();
      if (cancelled) await leaveCommObserverWatch();
    };
    join();
    const unsub = subscribeChatPresence((event, payload) => {
      if (
        event === "ConnectionState" &&
        payload === "connected" &&
        !cancelled
      ) {
        join();
      }
    });
    return () => {
      cancelled = true;
      unsub?.();
      leaveCommObserverWatch();
    };
  }, [allowed]);

  const pickToUser = (userId) => {
    if (String(userId) === String(fromUserId)) return;
    setActiveGroupId("");
    setCustomActiveTab("1");
    setToUserId(String(userId));
  };

  const pickGroup = (group) => {
    if (!group?.groupId) return;
    setActiveGroupId(String(group.groupId));
    setCustomActiveTab("2");
  };

  const downloadAttachment = useCallback(async (msg) => {
    const path = msg?.attachmentPath1;
    if (!path) {
      setSendError("File path not available for download.");
      return;
    }
    const key = String(msg.id || path);
    setDownloadingIds((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    try {
      const blob = await fetchChatAttachmentBlob(path);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download =
        msg.fileName || String(path).split("/").pop() || "attachment";
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      setSendError(err?.message || "Download failed. Please try again.");
    } finally {
      setDownloadingIds((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const openAttachmentUrl = useCallback((url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const openMessageInfo = useCallback(async (msg) => {
    setInfoMsg(msg);
    setInfoExtra(null);
    setInfoLoading(true);
    try {
      const info = await getChatMessageInfo(msg.id);
      const readRows = (info?.members || []).filter((m) => m.readAt);
      const deliveredRows = (info?.members || []).filter(
        (m) => !m.readAt && m.deliveredAt
      );
      setInfoExtra({
        sentAt: info?.sentAt || msg.sentAt,
        readRows,
        deliveredRows,
      });
    } catch {
      setInfoExtra({ sentAt: msg.sentAt, readRows: [], deliveredRows: [] });
    } finally {
      setInfoLoading(false);
    }
  }, []);

  const closeMessageInfo = useCallback(() => {
    setInfoMsg(null);
    setInfoExtra(null);
    setInfoLoading(false);
  }, []);

  const showDmChat = Boolean(fromUser && toUser && pairKey) && !isGroupView;
  const showGroupChat = isGroupView && Boolean(activeGroup?.chatId);
  const showPanel = showDmChat || showGroupChat;
  const panelLoading = isGroupView ? groupLoading : threadLoading;
  const panelMessages = isGroupView ? groupMessages : activeMessages;
  const panelVisibleMessages = isGroupView
    ? visibleGroupMessages
    : visibleMessages;

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="All User Communication" pageTitle="Chat" />

        {!allowed ? (
          <Alert color="warning" className="mb-0">
            All User Communication is hidden for your SoftOnCloud{" "}
            <strong>userType</strong>. Your type must match organisation setting{" "}
            <code>AllUserCommunicationUserType</code> (e.g.{" "}
            <strong>PRIME,ADMIN</strong>) — SoftOnCloud{" "}
            <strong>userType</strong> or <strong>roleNames</strong> (Admin).
          </Alert>
        ) : null}

        {allowed && sendError ? (
          <Alert color="danger" toggle={() => setSendError("")}>
            {sendError}
          </Alert>
        ) : null}

        {allowed ? (
        <div className="chat-wrapper d-lg-flex gap-1 mx-n4 mt-n4 p-1">
          <div className="chat-leftsidebar">
            <div className="px-4 pt-4 mb-3">
              <h5 className="mb-4">Chats</h5>
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

            <Nav
              tabs
              className="nav nav-tabs nav-tabs-custom nav-success nav-justified mb-3"
            >
              <NavItem>
                <NavLink
                  style={{ cursor: "pointer" }}
                  className={classnames({
                    active: customActiveTab === "1",
                  })}
                  onClick={() =>
                    toggleCustomTab(
                      customActiveTab,
                      "1",
                      setCustomActiveTab
                    )
                  }
                >
                  Chats
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  style={{ cursor: "pointer" }}
                  className={classnames({
                    active: customActiveTab === "2",
                  })}
                  onClick={() =>
                    toggleCustomTab(
                      customActiveTab,
                      "2",
                      setCustomActiveTab
                    )
                  }
                >
                  Groups
                </NavLink>
              </NavItem>
            </Nav>

            <TabContent activeTab={customActiveTab} className="text-muted">
              <TabPane tabId="1" id="auc-chats">
                <SimpleBar
                  className="chat-room-list pt-3"
                  style={{ margin: "-16px 0px 0px" }}
                >
                  <div className="d-flex align-items-center px-4 mb-2">
                    <div className="flex-grow-1">
                      <h4 className="mb-0 fs-11 text-muted text-uppercase">
                        Direct Messages
                      </h4>
                    </div>
                  </div>
                  <div className="chat-message-list">
                    {loading && (
                      <div className="text-center text-muted py-4 fs-13 px-3">
                        Loading users...
                      </div>
                    )}
                    {!loading && usersError && (
                      <div className="text-center text-danger py-4 px-3 fs-13">
                        {usersError}
                      </div>
                    )}
                    {!loading &&
                      !usersError &&
                      !filteredUsers.length && (
                        <div className="text-center text-muted py-4 px-3 fs-13">
                          No users found
                        </div>
                      )}
                    <ul className="list-unstyled chat-list chat-user-list users-list">
                      {!loading &&
                        !usersError &&
                        filteredUsers.map((user) => {
                          const presence = user.isSelf
                            ? { status: "online", changedAt: null }
                            : presenceByUserId[String(user.id)];
                          const isOnline =
                            user.isSelf ||
                            presence?.status === "online";
                          const presenceLabel = formatPresenceLabel(
                            presence,
                            user.isSelf
                          );
                          const presenceTime = presence?.changedAt
                            ? formatMsgTime(presence.changedAt)
                            : "";
                          return (
                            <li
                              key={user.id}
                              className={
                                String(toUserId) === String(user.id)
                                  ? "active"
                                  : ""
                              }
                            >
                              <Link
                                to="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  pickToUser(user.id);
                                }}
                              >
                                <div className="d-flex align-items-center">
                                  <div
                                    className={classnames(
                                      "flex-shrink-0 chat-user-img align-self-center me-2 ms-0",
                                      isOnline ? "online" : "offline"
                                    )}
                                  >
                                    <div className="avatar-xs">
                                      <img
                                        src={getCommAvatarSrc(
                                          user.id,
                                          user.avatarSrc
                                        )}
                                        className="rounded-circle img-fluid userprofile"
                                        alt=""
                                      />
                                      <span className="user-status"></span>
                                    </div>
                                  </div>
                                  <div className="flex-grow-1 overflow-hidden">
                                    <p className="text-truncate mb-0">
                                      {user.name}
                                    </p>
                                    <p
                                      className={classnames(
                                        "text-truncate mb-0 fs-12",
                                        isOnline
                                          ? "text-success"
                                          : "text-muted"
                                      )}
                                    >
                                      {presenceLabel}
                                    </p>
                                  </div>
                                  {presenceTime ? (
                                    <small className="text-muted flex-shrink-0">
                                      {presenceTime}
                                    </small>
                                  ) : null}
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                </SimpleBar>
              </TabPane>

              <AucGroupsSidebarTab
                groupsLoading={groupsLoading}
                groupsError={groupsError}
                filteredGroups={filteredGroups}
                activeGroupId={activeGroupId}
                onPickGroup={pickGroup}
              />
            </TabContent>
          </div>

          <div
            className="user-chat w-100 overflow-hidden user-chat-show"
            ref={userChatShow}
          >
              <div className="chat-content d-lg-flex">
                <div className="w-100 overflow-hidden position-relative">
                  <div className="position-relative">
                    <div className="p-3 user-chat-topbar border-bottom">
                      {isGroupView ? (
                        <AucGroupChatTopbar
                          group={activeGroup}
                          onOpenInfo={() => setGroupInfoOpen(true)}
                        />
                      ) : (
                        <Row className="g-2 align-items-end">
                          <Col md={4} sm={6}>
                            <Label className="form-label fs-12 mb-1">To</Label>
                            <UserAvatarSelect
                              id="auc-to-user"
                              value={toUserId}
                              options={toSelectOptions}
                              placeholder="Select To"
                              onChange={(nextTo) => {
                                setToUserId(nextTo);
                                if (nextTo && nextTo === String(fromUserId)) {
                                  setFromUserId("");
                                }
                              }}
                            />
                          </Col>
                          <Col md={4} sm={6}>
                            <Label className="form-label fs-12 mb-1">From</Label>
                            <UserAvatarSelect
                              id="auc-from-user"
                              value={fromUserId}
                              options={fromSelectOptions}
                              placeholder="Select From"
                              onChange={(nextFrom) => {
                                setFromUserId(nextFrom);
                                if (nextFrom && nextFrom === String(toUserId)) {
                                  setToUserId("");
                                }
                              }}
                            />
                          </Col>
                          <Col md={4} className="text-md-end">
                            <div className="d-flex align-items-center justify-content-md-end gap-2 flex-wrap">
                              {toUser ? (
                                <img
                                  src={getCommAvatarSrc(
                                    toUser.id,
                                    toUser.avatarSrc
                                  )}
                                  alt=""
                                  className="rounded-circle"
                                  style={{
                                    width: 28,
                                    height: 28,
                                    objectFit: "cover",
                                  }}
                                />
                              ) : null}
                              {showDmChat ? (
                                <p className="text-muted fs-12 mb-0">
                                  Viewing:{" "}
                                  <strong>{toUser?.realName}</strong>
                                  {" ← "}
                                  <strong>{fromUser?.realName}</strong>
                                </p>
                              ) : (
                                <p className="text-muted fs-12 mb-0">
                                  Select To and From
                                </p>
                              )}
                              {fromUser ? (
                                <img
                                  src={getCommAvatarSrc(
                                    fromUser.id,
                                    fromUser.avatarSrc
                                  )}
                                  alt=""
                                  className="rounded-circle"
                                  style={{
                                    width: 28,
                                    height: 28,
                                    objectFit: "cover",
                                  }}
                                />
                              ) : null}
                            </div>
                          </Col>
                        </Row>
                      )}
                    </div>

                    <div className="chat-conversation">
                      <div className="chat-conversation-scroll" ref={scrollRef}>
                        {!showPanel ? (
                          <div className="d-flex align-items-center justify-content-center text-muted px-3 text-center py-5">
                            {loading || groupsLoading
                              ? "Loading..."
                              : customActiveTab === "2"
                                ? "Select a group to view messages"
                                : "Select To + From to load messages"}
                          </div>
                        ) : panelLoading ? (
                          <div className="text-center py-5">
                            <Spinner color="primary" size="sm" />
                            <p className="text-muted fs-12 mt-2 mb-0">
                              Loading messages…
                            </p>
                          </div>
                        ) : isGroupView && groupError ? (
                          <div className="text-center text-danger py-5 fs-13 px-3">
                            {groupError}
                          </div>
                        ) : (
                          <ul className="list-unstyled chat-conversation-list mb-0">
                            {!panelMessages.length ? (
                              <li className="text-center text-muted py-5 fs-13">
                                {isGroupView
                                  ? `No messages in ${activeGroup?.name || "group"}`
                                  : `No messages between ${fromUser?.realName} and ${toUser?.realName}`}
                              </li>
                            ) : (
                              panelVisibleMessages.map((msg) =>
                                msg.isDateSeparator ? (
                                  <li
                                    key={msg.id}
                                    className="chat-list chat-day-separator"
                                  >
                                    <div className="chat-day-chip">
                                      {msg.label}
                                    </div>
                                  </li>
                                ) : (
                                  <li
                                    key={msg.id}
                                    className={classnames("chat-list", {
                                      right: msg.side === "from",
                                      left: msg.side !== "from",
                                    })}
                                  >
                                    <div className="conversation-list">
                                      <div className="chat-avatar">
                                        <img
                                          src={getCommAvatarSrc(
                                            msg.senderId,
                                            msg.senderAvatarSrc
                                          )}
                                          alt=""
                                          title={msg.senderName}
                                        />
                                      </div>
                                      <div className="user-chat-content">
                                        <div className="ctext-wrap">
                                          <div className="ctext-wrap-content">
                                            <small className="d-block text-muted mb-1 fs-11">
                                              {msg.senderName}
                                            </small>
                                            {msg.deletedAt ? (
                                              <p className="mb-0 ctext-content text-muted fst-italic">
                                                This message was deleted
                                              </p>
                                            ) : msg.type === "file" ||
                                              msg.attachKind ? (
                                              <>
                                                {msg.mediaSubtype ===
                                                  "photo" ||
                                                msg.mediaSubtype ===
                                                  "video" ? (
                                                  <AucMediaPreview
                                                    path={msg.attachmentPath1}
                                                    fileName={msg.fileName}
                                                    kind={
                                                      msg.mediaSubtype ===
                                                      "video"
                                                        ? "video"
                                                        : "photo"
                                                    }
                                                    downloading={downloadingIds.has(
                                                      String(msg.id)
                                                    )}
                                                    onOpen={openAttachmentUrl}
                                                    onDownload={() =>
                                                      downloadAttachment(msg)
                                                    }
                                                  />
                                                ) : (
                                                  <div
                                                    className="d-flex align-items-center gap-2 text-start comm-attach-card"
                                                    role="button"
                                                    title="Download file"
                                                    style={{
                                                      cursor: msg.attachmentPath1
                                                        ? "pointer"
                                                        : "default",
                                                    }}
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      if (
                                                        !msg.attachmentPath1 ||
                                                        downloadingIds.has(
                                                          String(msg.id)
                                                        )
                                                      ) {
                                                        return;
                                                      }
                                                      downloadAttachment(msg);
                                                    }}
                                                  >
                                                    <span className="avatar-xs flex-shrink-0">
                                                      <span className="avatar-title rounded bg-light text-body">
                                                        <i
                                                          className={attachIconForMessage(
                                                            msg
                                                          )}
                                                        ></i>
                                                      </span>
                                                    </span>
                                                    <div className="overflow-hidden flex-grow-1">
                                                      <p className="mb-0 ctext-content text-truncate">
                                                        {msg.fileName ||
                                                          msg.text ||
                                                          "Document"}
                                                      </p>
                                                      <small className="text-muted text-uppercase">
                                                        {msg.attachKind ===
                                                        "audio"
                                                          ? "Audio"
                                                          : "Document"}
                                                      </small>
                                                    </div>
                                                    {msg.attachmentPath1 ? (
                                                      <span className="comm-attach-action flex-shrink-0">
                                                        {downloadingIds.has(
                                                          String(msg.id)
                                                        ) ? (
                                                          <i className="ri-loader-4-line text-muted spin-icon"></i>
                                                        ) : (
                                                          <i
                                                            className="ri-download-2-line text-muted"
                                                            title="Download"
                                                          ></i>
                                                        )}
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                )}
                                                {msg.caption ? (
                                                  <p className="mb-0 mt-2 ctext-content">
                                                    {msg.caption}
                                                  </p>
                                                ) : null}
                                              </>
                                            ) : (
                                              <p className="mb-0 ctext-content">
                                                {msg.text}
                                              </p>
                                            )}
                                          </div>
                                          <UncontrolledDropdown className="align-self-start message-box-drop">
                                            <DropdownToggle
                                              href="#"
                                              className="btn nav-btn"
                                              tag="a"
                                              onClick={(e) => e.preventDefault()}
                                            >
                                              <i className="ri-more-2-fill"></i>
                                            </DropdownToggle>
                                            <DropdownMenu className="dropdown-menu-end">
                                              <DropdownItem
                                                href="#"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  openMessageInfo(msg);
                                                }}
                                              >
                                                <i className="ri-information-line me-2 text-muted"></i>
                                                Info
                                              </DropdownItem>
                                              {(msg.type === "file" ||
                                                msg.attachKind) &&
                                              msg.attachmentPath1 ? (
                                                <DropdownItem
                                                  href="#"
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    downloadAttachment(msg);
                                                  }}
                                                >
                                                  <i className="ri-download-2-line me-2 text-muted"></i>
                                                  Download
                                                </DropdownItem>
                                              ) : null}
                                            </DropdownMenu>
                                          </UncontrolledDropdown>
                                        </div>
                                        <div className="conversation-name">
                                          <small className="text-muted time">
                                            {msg.time}
                                          </small>
                                          {msg.side === "from" ? (
                                            <span className="text-success check-message-icon">
                                              <i
                                                className={
                                                  msg.status === "Seen"
                                                    ? "ri-check-double-line ticks ticks-read"
                                                    : "ri-check-double-line ticks ticks-delivered"
                                                }
                                              ></i>
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  </li>
                                )
                              )
                            )}
                          </ul>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
          </div>
        </div>
        ) : null}

        <AucGroupInfoModal
          isOpen={groupInfoOpen && Boolean(activeGroup)}
          onClose={() => setGroupInfoOpen(false)}
          group={activeGroup}
          users={users}
        />

        <Modal
          isOpen={Boolean(infoMsg)}
          toggle={closeMessageInfo}
          centered
          className="comm-auc-msg-info"
        >
          <ModalHeader toggle={closeMessageInfo}>Message info</ModalHeader>
          <ModalBody>
            {!infoMsg ? null : infoLoading ? (
              <div className="text-center py-4 text-muted">
                <Spinner size="sm" className="me-2" />
                Loading...
              </div>
            ) : (
              <div className="fs-13">
                <div className="d-flex justify-content-between py-2 border-bottom">
                  <span className="text-muted">From</span>
                  <strong className="text-end ms-3">
                    {infoMsg.senderName}
                  </strong>
                </div>
                <div className="d-flex justify-content-between py-2 border-bottom">
                  <span className="text-muted">To</span>
                  <strong className="text-end ms-3">
                    {infoMsg.receiverName}
                  </strong>
                </div>
                <div className="d-flex justify-content-between py-2 border-bottom">
                  <span className="text-muted">Sent</span>
                  <strong className="text-end ms-3">
                    {formatMessageInfoWhen(
                      infoExtra?.sentAt || infoMsg.sentAt
                    ) ||
                      infoMsg.time ||
                      "—"}
                  </strong>
                </div>
                <div className="d-flex justify-content-between py-2 border-bottom">
                  <span className="text-muted">Seen</span>
                  <strong className="text-end ms-3">
                    {infoMsg.readAt || infoExtra?.readRows?.[0]?.readAt
                      ? formatMessageInfoWhen(
                          infoMsg.readAt || infoExtra.readRows[0].readAt
                        )
                      : "Not seen"}
                  </strong>
                </div>
                <div className="d-flex justify-content-between py-2">
                  <span className="text-muted">Deleted</span>
                  <strong
                    className={classnames("text-end ms-3", {
                      "text-danger": Boolean(infoMsg.deletedAt),
                    })}
                  >
                    {infoMsg.deletedAt
                      ? `${formatMessageInfoWhen(infoMsg.deletedAt)}${
                          infoMsg.deletedByName
                            ? ` · by ${infoMsg.deletedByName}`
                            : ""
                        }`
                      : "Not deleted"}
                  </strong>
                </div>
                {infoMsg.type === "file" || infoMsg.fileName ? (
                  <div className="d-flex justify-content-between py-2 border-top mt-1">
                    <span className="text-muted">File</span>
                    <strong className="text-end ms-3 text-truncate">
                      {infoMsg.fileName || "Attachment"}
                    </strong>
                  </div>
                ) : null}
              </div>
            )}
          </ModalBody>
        </Modal>
      </Container>
    </div>
  );
};

export default AllUserCommunication;
