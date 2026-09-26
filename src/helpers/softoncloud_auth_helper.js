import { APIClient, setAuthorization } from "./api_helper";
import * as url from "./url_helper";
import { api as appConfig } from "../config";
import { APP_LOGO } from "./branding";
import axios from "axios";
import * as signalR from "@microsoft/signalr";

const api = new APIClient();

// ─── Shared Chat SignalR connection (singleton — no duplicate hubs) ───────────
let chatHubConnection = null;
let chatHubStartPromise = null;
const chatPresenceListeners = new Set();
/** Last known online user ids — late subscribers get this without waiting for hub. */
let lastOnlineUserIds = [];
/** userId → { status, statusMessage } from Settings / hub (Away/Busy/Offline). */
let lastUserStatuses = {};

const syncPresenceCache = (event, payload) => {
  if (event === "OnlineUsers") {
    lastOnlineUserIds = Array.isArray(payload)
      ? payload.map((id) => String(id))
      : [];
    return;
  }
  if (event === "UserOnline") {
    const id = String(payload);
    if (id && !lastOnlineUserIds.includes(id)) {
      lastOnlineUserIds = [...lastOnlineUserIds, id];
    }
    return;
  }
  if (event === "UserOffline") {
    const id = String(payload);
    lastOnlineUserIds = lastOnlineUserIds.filter((x) => x !== id);
    return;
  }
  if (event === "UserStatusChanged") {
    const userId = String(
      payload?.userId ?? payload?.UserId ?? ""
    );
    if (!userId) return;
    const status = String(
      payload?.status ?? payload?.Status ?? "Online"
    ).trim() || "Online";
    const statusMessage = String(
      payload?.statusMessage ?? payload?.StatusMessage ?? ""
    );
    lastUserStatuses = {
      ...lastUserStatuses,
      [userId]: { status, statusMessage },
    };
    return;
  }
  if (event === "UserStatuses") {
    const map = {};
    const list = Array.isArray(payload) ? payload : [];
    list.forEach((row) => {
      const userId = String(row?.userId ?? row?.UserId ?? "");
      if (!userId) return;
      map[userId] = {
        status: String(row?.status ?? row?.Status ?? "Online").trim() || "Online",
        statusMessage: String(
          row?.statusMessage ?? row?.StatusMessage ?? ""
        ),
      };
    });
    lastUserStatuses = map;
    return;
  }
  if (event === "ConnectionState" && payload === "disconnected") {
    lastOnlineUserIds = [];
  }
};

const notifyChatPresence = (event, payload) => {
  syncPresenceCache(event, payload);
  chatPresenceListeners.forEach((listener) => {
    try {
      listener(event, payload);
    } catch {
      // ignore listener errors
    }
  });
};

// ─── Settings runtime prefs (session) — used by bell / hub (not Messages/Groups UI) ───
const CHAT_RUNTIME_PREFS_KEY = "chatRuntimePrefs";
let chatRuntimePrefsLoadPromise = null;
let chatRuntimePrefsLoadedOk = false;
const DEFAULT_CHAT_RUNTIME_PREFS = {
  defaultMessageTypeId: 0,
  defaultTypeName: "Text",
  requestReadReceipt: true,
  autoSaveDraft: false,
  // Notification delivery: all | browser | bell_browser
  messageReceived: "all",
  groupMessages: "all",
  announcements: "all",
  soundEnabled: true,
  desktopEnabled: true,
  emailEnabled: false,
  mobilePushEnabled: false,
  status: "Online",
  statusMessage: "",
};

/** Coerce API / form values — "false" must be false (Boolean("false") === true). */
const toPrefBool = (value, fallback = true) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const s = String(value).trim().toLowerCase();
  if (s === "false" || s === "0" || s === "no" || s === "none" || s === "off") {
    return false;
  }
  if (s === "true" || s === "1" || s === "yes" || s === "all" || s === "on") {
    return true;
  }
  return fallback;
};

/**
 * Settings → Notifications delivery mode.
 * all | browser | bell_browser (Notification ball with browser)
 */
export const normalizeNotifMode = (value, fallback = "all") => {
  if (value === true || value === 1) return "all";
  if (value === false || value === 0) return "browser";
  const s = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s+]+/g, "_");
  if (!s) return fallback;
  if (s === "all" || s === "true" || s === "on") return "all";
  if (s === "browser" || s === "desktop") return "browser";
  if (
    s === "bell_browser" ||
    s === "bell" ||
    s === "notification_ball" ||
    s === "notification_ball_with_browser" ||
    s === "ball_browser" ||
    s === "bell+browser"
  ) {
    return "bell_browser";
  }
  if (s === "none" || s === "false" || s === "off") return "browser";
  return fallback;
};

/** Header notification bell (ball) shows this channel? */
export const notifModeShowsBell = (mode) => {
  const m = normalizeNotifMode(mode);
  // All = ball only; Ball + Browser = both
  return m === "all" || m === "bell_browser";
};

/** Browser desktop Notification API shows this channel? */
export const notifModeShowsBrowser = (mode) => {
  const m = normalizeNotifMode(mode);
  // Browser = browser only; Ball + Browser = both (All = ball only)
  return m === "browser" || m === "bell_browser";
};

const readChatRuntimePrefsRaw = () => {
  try {
    const raw = sessionStorage.getItem(CHAT_RUNTIME_PREFS_KEY);
    if (!raw) return { ...DEFAULT_CHAT_RUNTIME_PREFS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CHAT_RUNTIME_PREFS,
      ...parsed,
      requestReadReceipt: toPrefBool(parsed.requestReadReceipt, true),
      autoSaveDraft: toPrefBool(parsed.autoSaveDraft, false),
      messageReceived: normalizeNotifMode(parsed.messageReceived, "all"),
      groupMessages: normalizeNotifMode(parsed.groupMessages, "all"),
      announcements: normalizeNotifMode(parsed.announcements, "all"),
      soundEnabled: toPrefBool(parsed.soundEnabled, true),
      desktopEnabled: toPrefBool(parsed.desktopEnabled, true),
      emailEnabled: toPrefBool(parsed.emailEnabled, false),
      mobilePushEnabled: toPrefBool(parsed.mobilePushEnabled, false),
    };
  } catch {
    return { ...DEFAULT_CHAT_RUNTIME_PREFS };
  }
};

/** Read Settings prefs cached for runtime (notifications / status / message defaults). */
export const getChatRuntimePrefs = () => readChatRuntimePrefsRaw();

/** Persist Settings prefs + notify listeners (Settings page save/load). */
export const setChatRuntimePrefs = (partial) => {
  const next = {
    ...readChatRuntimePrefsRaw(),
    ...(partial && typeof partial === "object" ? partial : {}),
  };
  next.messageReceived = normalizeNotifMode(next.messageReceived, "all");
  next.groupMessages = normalizeNotifMode(next.groupMessages, "all");
  next.announcements = normalizeNotifMode(next.announcements, "all");
  next.soundEnabled = toPrefBool(next.soundEnabled, true);
  next.desktopEnabled = toPrefBool(next.desktopEnabled, true);
  next.requestReadReceipt = toPrefBool(next.requestReadReceipt, true);
  next.autoSaveDraft = toPrefBool(next.autoSaveDraft, false);
  try {
    sessionStorage.setItem(CHAT_RUNTIME_PREFS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  chatRuntimePrefsLoadedOk = true;
  try {
    window.dispatchEvent(
      new CustomEvent("chat-runtime-prefs-updated", { detail: next })
    );
  } catch {
    /* ignore */
  }
  return next;
};

/**
 * Sync full GET /api/settings (or normalized Settings state) into runtime prefs.
 * Keeps existing All/Browser/Bell modes when API only returns booleans.
 */
export const syncChatRuntimePrefsFromSettings = (settingsLike) => {
  const data = settingsLike || {};
  const messageDefaults = data.messageDefaults || data.MessageDefaults || {};
  const notifications = data.notifications || data.Notifications || {};
  const status = data.status || data.Status || {};
  const existing = readChatRuntimePrefsRaw();
  const types =
    messageDefaults.messageTypes || messageDefaults.MessageTypes || [];
  const defaultId = Number(
    messageDefaults.defaultMessageTypeId ??
      messageDefaults.DefaultMessageTypeId ??
      0
  );
  const match = (Array.isArray(types) ? types : []).find(
    (t) =>
      Number(t?.messageTypeId ?? t?.MessageTypeId) === defaultId
  );
  const typeName = String(
    match?.typeName ?? match?.TypeName ?? messageDefaults.defaultTypeName ?? "Text"
  );

  const pickMode = (incoming, prevMode) => {
    if (incoming === undefined || incoming === null) {
      return normalizeNotifMode(prevMode, "all");
    }
    // Explicit mode string from Settings form
    if (typeof incoming === "string" && !/^(true|false)$/i.test(incoming)) {
      return normalizeNotifMode(incoming, prevMode || "all");
    }
    // API boolean: true keep previous mode (or all); false → browser-only legacy
    if (incoming === true || incoming === "true") {
      return normalizeNotifMode(prevMode, "all");
    }
    if (incoming === false || incoming === "false") {
      return "browser";
    }
    return normalizeNotifMode(incoming, prevMode || "all");
  };

  return setChatRuntimePrefs({
    defaultMessageTypeId: defaultId,
    defaultTypeName: typeName,
    requestReadReceipt: toPrefBool(
      messageDefaults.requestReadReceipt ?? messageDefaults.RequestReadReceipt,
      true
    ),
    autoSaveDraft: toPrefBool(
      messageDefaults.autoSaveDraft ?? messageDefaults.AutoSaveDraft,
      false
    ),
    messageReceived: pickMode(
      notifications.messageReceived ?? notifications.MessageReceived,
      existing.messageReceived
    ),
    groupMessages: pickMode(
      notifications.groupMessages ?? notifications.GroupMessages,
      existing.groupMessages
    ),
    announcements: pickMode(
      notifications.announcements ?? notifications.Announcements,
      existing.announcements
    ),
    soundEnabled: toPrefBool(
      notifications.soundEnabled ?? notifications.SoundEnabled,
      true
    ),
    desktopEnabled: toPrefBool(
      notifications.desktopEnabled ?? notifications.DesktopEnabled,
      true
    ),
    emailEnabled: toPrefBool(
      notifications.emailEnabled ?? notifications.EmailEnabled,
      false
    ),
    mobilePushEnabled: toPrefBool(
      notifications.mobilePushEnabled ?? notifications.MobilePushEnabled,
      false
    ),
    status: String(status.status ?? status.Status ?? "Online").trim() || "Online",
    statusMessage: String(
      status.statusMessage ?? status.StatusMessage ?? ""
    ),
  });
};

/**
 * Load GET /api/settings once into session prefs so bell respects
 * Announcements / Messages / Groups All|None without opening Settings.
 */
export const ensureChatRuntimePrefsLoaded = async (force = false) => {
  if (!force && chatRuntimePrefsLoadedOk) {
    return readChatRuntimePrefsRaw();
  }
  if (!force && chatRuntimePrefsLoadPromise) return chatRuntimePrefsLoadPromise;
  chatRuntimePrefsLoadPromise = (async () => {
    try {
      const raw = await getChatSettings();
      const prefs = syncChatRuntimePrefsFromSettings(raw);
      chatRuntimePrefsLoadedOk = true;
      return prefs;
    } catch {
      chatRuntimePrefsLoadedOk = false;
      return readChatRuntimePrefsRaw();
    } finally {
      chatRuntimePrefsLoadPromise = null;
    }
  })();
  return chatRuntimePrefsLoadPromise;
};

const classifyNotificationChannel = (payload) => {
  if (!payload || typeof payload !== "object") return "message";
  const type = String(
    payload.notificationType ?? payload.NotificationType ?? ""
  ).toUpperCase();
  const refType = String(
    payload.referenceType ?? payload.ReferenceType ?? ""
  ).toUpperCase();
  const refEntity = String(
    payload.referenceEntity ?? payload.ReferenceEntity ?? ""
  ).toLowerCase();
  const title = String(payload.title ?? payload.Title ?? "").toLowerCase();
  const groupId = payload.groupId ?? payload.GroupId;

  if (
    type === "ANNOUNCEMENT" ||
    refType === "ANNOUNCEMENT" ||
    refEntity.includes("announcement") ||
    title.includes("announcement")
  ) {
    return "announcement";
  }
  if (
    type === "GROUP" ||
    (groupId != null && groupId !== "") ||
    /^GROUP:\d+$/i.test(refType) ||
    refEntity.includes("tab_groups")
  ) {
    return "group";
  }
  return "message";
};

/** Channel mode for a notification payload (all | browser | bell_browser). */
export const getChatNotificationMode = (payload) => {
  const prefs = readChatRuntimePrefsRaw();
  const channel = classifyNotificationChannel(payload);
  if (channel === "announcement") return normalizeNotifMode(prefs.announcements);
  if (channel === "group") return normalizeNotifMode(prefs.groupMessages);
  return normalizeNotifMode(prefs.messageReceived);
};

/** Header bell (notification ball) — All / Notification ball with browser. */
export const isChatNotificationAllowed = (payload) =>
  notifModeShowsBell(getChatNotificationMode(payload));

/** Browser desktop popup — Browser / Ball + Browser (Settings). */
export const isChatBrowserNotificationAllowed = (payload) =>
  notifModeShowsBrowser(getChatNotificationMode(payload));

/** One OS popup per notificationId (SignalR retries / duplicate events). */
const shownDesktopNotificationIds = new Set();

const resolveChatNotificationIconUrl = () => {
  try {
    if (typeof window === "undefined" || !window.location?.origin) {
      return APP_LOGO;
    }
    return new URL(APP_LOGO, window.location.origin).href;
  } catch {
    return `${typeof window !== "undefined" ? window.location.origin : ""}/logo.png`;
  }
};

const writeChatUiStateFromDesktopNotif = (patch) => {
  try {
    const prev =
      JSON.parse(sessionStorage.getItem("chatUiState") || "null") || {};
    sessionStorage.setItem(
      "chatUiState",
      JSON.stringify({ ...prev, ...patch })
    );
  } catch {
    /* ignore */
  }
};

/** Resolve path + chatUiState for notification click (mirrors bell dropdown). */
const resolveDesktopNotificationNavigation = (payload) => {
  if (!payload || typeof payload !== "object") {
    return { path: "/communication/messages", state: {} };
  }
  const type = String(
    payload.notificationType ?? payload.NotificationType ?? ""
  ).toUpperCase();
  const refType = String(
    payload.referenceType ?? payload.ReferenceType ?? ""
  );
  const refEntity = String(
    payload.referenceEntity ?? payload.ReferenceEntity ?? ""
  ).toLowerCase();
  const title = String(payload.title ?? payload.Title ?? "").toLowerCase();
  const referenceId = payload.referenceId ?? payload.ReferenceId ?? null;
  const senderUserId = payload.senderUserId ?? payload.SenderUserId ?? null;
  const groupIdRaw = payload.groupId ?? payload.GroupId;
  let groupId =
    groupIdRaw != null && groupIdRaw !== "" ? Number(groupIdRaw) : null;
  if (!(Number.isFinite(groupId) && groupId > 0) && refType) {
    const match = /^GROUP:(\d+)$/i.exec(String(refType).trim());
    if (match) groupId = Number(match[1]);
  }
  if (!(Number.isFinite(groupId) && groupId > 0)) groupId = null;

  const isAnnouncement =
    type === "ANNOUNCEMENT" ||
    String(refType).toUpperCase() === "ANNOUNCEMENT" ||
    refEntity.includes("announcement") ||
    title.includes("announcement");
  if (isAnnouncement) {
    return {
      path: "/communication/announcements",
      state: {
        openAnnouncementId:
          referenceId != null && referenceId !== ""
            ? String(referenceId)
            : null,
        openTs: Date.now(),
      },
    };
  }

  // Message first (incl. group messages with referenceType GROUP:n)
  if (type === "MESSAGE" || type === "") {
    const focusMessageId =
      referenceId != null && referenceId !== "" ? String(referenceId) : null;
    if (groupId != null) {
      writeChatUiStateFromDesktopNotif({
        openGroupId: String(groupId),
        focusMessageId,
      });
      return {
        path: "/communication/groups",
        state: { openGroupId: String(groupId), focusMessageId },
      };
    }
    if (senderUserId != null && senderUserId !== "") {
      writeChatUiStateFromDesktopNotif({
        activeUserId: String(senderUserId),
        focusMessageId,
      });
      return {
        path: "/communication/messages",
        state: {
          openPeerUserId: String(senderUserId),
          focusMessageId,
        },
      };
    }
  }

  const isGroupInvite =
    type === "GROUP" ||
    refEntity.includes("tab_groups") ||
    /^GROUP:\d+$/i.test(String(refType).trim());

  if (isGroupInvite && groupId != null) {
    writeChatUiStateFromDesktopNotif({
      openGroupId: String(groupId),
      focusMessageId: null,
    });
    return {
      path: "/communication/groups",
      state: { openGroupId: String(groupId), focusMessageId: null },
    };
  }

  return { path: "/communication/messages", state: {} };
};

const maybeShowDesktopChatNotification = (payload) => {
  if (!isChatBrowserNotificationAllowed(payload)) return;
  const prefs = readChatRuntimePrefsRaw();
  if (prefs.desktopEnabled === false) return;
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  // OS popup only when tab is in background (still visible after user returns).
  if (typeof document !== "undefined" && !document.hidden) return;

  const notificationId =
    payload?.notificationId ?? payload?.NotificationId ?? null;
  const dedupeKey =
    notificationId != null && notificationId !== ""
      ? String(notificationId)
      : null;
  if (dedupeKey && shownDesktopNotificationIds.has(dedupeKey)) return;
  if (dedupeKey) {
    shownDesktopNotificationIds.add(dedupeKey);
    // Bound growth — keep recent ids only
    if (shownDesktopNotificationIds.size > 200) {
      const first = shownDesktopNotificationIds.values().next().value;
      shownDesktopNotificationIds.delete(first);
    }
  }

  const title = String(payload?.title ?? payload?.Title ?? "SoftOnCloud Chat");
  const body = String(payload?.message ?? payload?.Message ?? "");
  const icon = resolveChatNotificationIconUrl();
  const tag = dedupeKey ? `soc-chat-${dedupeKey}` : "soc-chat-message";

  try {
    const n = new Notification(title, {
      body,
      icon,
      badge: icon,
      tag,
      renotify: false,
      silent: prefs.soundEnabled === false,
    });
    n.onclick = () => {
      try {
        n.close();
      } catch {
        /* ignore */
      }
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      const nav = resolveDesktopNotificationNavigation(payload);
      try {
        window.dispatchEvent(
          new CustomEvent("chat-desktop-notification-click", {
            detail: { payload, ...nav },
          })
        );
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* ignore */
  }
};

/** Publish My Status to SignalR peers (Settings → Save Status). */
export const publishChatUserStatus = async (
  status = "Online",
  statusMessage = ""
) => {
  const normalized =
    String(status || "Online").trim() || "Online";
  const message = String(statusMessage || "").trim();
  setChatRuntimePrefs({ status: normalized, statusMessage: message });

  const invokeOn = async (connection) => {
    if (
      connection &&
      connection.state === signalR.HubConnectionState.Connected
    ) {
      await connection.invoke("SetUserStatus", normalized, message);
    }
  };

  try {
    // Prefer live connection — avoid re-entering ensureChatHubConnection during start.
    if (chatHubConnection?.state === signalR.HubConnectionState.Connected) {
      await invokeOn(chatHubConnection);
      return;
    }
    const connection = await ensureChatHubConnection();
    await invokeOn(connection);
  } catch {
    /* hub optional — API prefs still saved */
  }
};

/** Snapshot of peer statuses from hub (userId → { status, statusMessage }). */
export const getCachedChatUserStatuses = () => ({ ...lastUserStatuses });

const bindChatHubHandlers = (connection) => {
  connection.off("UserOnline");
  connection.off("UserOffline");
  connection.off("OnlineUsers");
  connection.off("ReceiveMessage");
  connection.off("ReceiveNotification");
  connection.off("MessageDelivered");
  connection.off("MessagesRead");
  connection.off("MessageDeleted");
  connection.off("ChatCleared");
  connection.off("ChatDeleted");
  connection.off("MessageReaction");
  connection.off("AnnouncementChanged");
  connection.off("GroupCreated");
  connection.off("GroupMemberAdminChanged");
  connection.off("UserStatusChanged");
  connection.off("UserStatuses");

  connection.on("UserOnline", (userId) => {
    notifyChatPresence("UserOnline", userId);
  });
  connection.on("UserOffline", (userId) => {
    notifyChatPresence("UserOffline", userId);
  });
  connection.on("OnlineUsers", (userIds) => {
    notifyChatPresence("OnlineUsers", userIds);
  });
  connection.on("UserStatusChanged", (payload) => {
    notifyChatPresence("UserStatusChanged", payload);
  });
  connection.on("UserStatuses", (payload) => {
    notifyChatPresence("UserStatuses", payload);
  });
  // Push after Send Message API saves (ChatController → ReceiveMessage)
  connection.on("ReceiveMessage", (payload) => {
    notifyChatPresence("ReceiveMessage", payload);
  });
  connection.on("ReceiveNotification", (payload) => {
    // Settings → All / Browser / Notification ball with browser
    Promise.resolve(ensureChatRuntimePrefsLoaded())
      .catch(() => null)
      .then(() => {
        const showBell = isChatNotificationAllowed(payload);
        const showBrowser = isChatBrowserNotificationAllowed(payload);
        if (!showBell && !showBrowser) return;
        if (showBell) notifyChatPresence("ReceiveNotification", payload);
        if (showBrowser) maybeShowDesktopChatNotification(payload);
      });
  });
  connection.on("MessageDelivered", (payload) => {
    notifyChatPresence("MessageDelivered", payload);
  });
  connection.on("MessagesRead", (payload) => {
    notifyChatPresence("MessagesRead", payload);
  });
  connection.on("MessageDeleted", (payload) => {
    notifyChatPresence("MessageDeleted", payload);
  });
  connection.on("ChatCleared", (payload) => {
    notifyChatPresence("ChatCleared", payload);
  });
  connection.on("ChatDeleted", (payload) => {
    notifyChatPresence("ChatDeleted", payload);
  });
  connection.on("MessageReaction", (payload) => {
    notifyChatPresence("MessageReaction", payload);
  });
  connection.on("AnnouncementChanged", (payload) => {
    notifyChatPresence("AnnouncementChanged", payload);
  });
  connection.on("GroupCreated", (payload) => {
    notifyChatPresence("GroupCreated", payload);
  });
  connection.on("GroupMemberAdminChanged", (payload) => {
    notifyChatPresence("GroupMemberAdminChanged", payload);
  });

  connection.onreconnecting(() => {
    notifyChatPresence("ConnectionState", "reconnecting");
  });
  connection.onreconnected(() => {
    // Server OnConnectedAsync sends a fresh OnlineUsers snapshot
    notifyChatPresence("ConnectionState", "connected");
    connection.invoke("RequestOnlineUsers").catch(() => {});
  });
  connection.onclose(() => {
    notifyChatPresence("ConnectionState", "disconnected");
    chatHubStartPromise = null;
  });
};

/**
 * Single shared HubConnection to /hubs/chat.
 * Reuses the same instance across the Messages UI (no duplicate connections).
 */
export const ensureChatHubConnection = async () => {
  const ctx = getChatApiContext();
  if (!ctx.token) {
    throw new Error("Authentication token missing. Please sign in again.");
  }

  const base = getChatApiBaseUrl();
  if (!base) {
    throw new Error("Chat API URL is not configured (REACT_APP_CHAT_API_URL).");
  }

  if (
    chatHubConnection &&
    chatHubConnection.state !== signalR.HubConnectionState.Disconnected
  ) {
    return chatHubConnection;
  }

  if (chatHubStartPromise) {
    return chatHubStartPromise;
  }

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${base}/hubs/chat`, {
      accessTokenFactory: () => {
        const latest = getChatApiContext();
        return latest.token || "";
      },
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  bindChatHubHandlers(connection);
  chatHubConnection = connection;

  chatHubStartPromise = connection
    .start()
    .then(async () => {
      notifyChatPresence("ConnectionState", "connected");
      try {
        await ensureChatRuntimePrefsLoaded();
      } catch {
        /* prefs optional at connect */
      }
      // Re-publish Settings → My Status after reconnect (direct invoke — no ensure re-entry).
      try {
        const prefs = readChatRuntimePrefsRaw();
        await connection.invoke(
          "SetUserStatus",
          prefs.status || "Online",
          prefs.statusMessage || ""
        );
      } catch {
        /* hub may be older build */
      }
      try {
        await connection.invoke("RequestUserStatuses");
      } catch {
        /* hub may be older build */
      }
      return connection;
    })
    .catch((error) => {
      chatHubConnection = null;
      chatHubStartPromise = null;
      notifyChatPresence("ConnectionState", "disconnected");
      throw error;
    });

  return chatHubStartPromise;
};

/**
 * Subscribe to chat hub events on the shared SignalR connection.
 * Events: UserOnline | UserOffline | OnlineUsers | ReceiveMessage | ReceiveNotification | MessageDelivered | MessagesRead | MessageReaction | MessageDeleted | ChatCleared | ChatDeleted | AnnouncementChanged | ConnectionState
 * Returns unsubscribe function.
 */
export const subscribeChatPresence = (listener) => {
  if (typeof listener === "function") {
    chatPresenceListeners.add(listener);
    // Replay cached presence immediately so Online/Offline updates without refresh
    // when Messages mounts after layout already connected the hub.
    try {
      if (lastOnlineUserIds.length > 0) {
        listener("OnlineUsers", [...lastOnlineUserIds]);
      }
      if (Object.keys(lastUserStatuses).length > 0) {
        listener(
          "UserStatuses",
          Object.entries(lastUserStatuses).map(([userId, row]) => ({
            userId,
            status: row.status,
            statusMessage: row.statusMessage,
          }))
        );
      }
    } catch {
      // ignore listener errors
    }
  }
  ensureChatHubConnection()
    .then(async (connection) => {
      if (
        connection?.state === signalR.HubConnectionState.Connected
      ) {
        // Late subscribers (e.g. Messages after layout already connected)
        // must learn hub is up — otherwise "You" stays grey until refresh.
        try {
          listener?.("ConnectionState", "connected");
        } catch {
          // ignore listener errors
        }
        try {
          await connection.invoke("RequestOnlineUsers");
        } catch {
          // Snapshot also arrives via OnConnectedAsync / presence cache
        }
      }
    })
    .catch(() => {
      // Connection errors surface via ConnectionState; UI stays Offline.
    });
  return () => {
    chatPresenceListeners.delete(listener);
  };
};

/** Join SignalR group:{groupId} after hub validates active membership. */
export const joinChatGroupHub = async (groupId) => {
  const parsed = Number(groupId);
  if (!Number.isFinite(parsed) || parsed <= 0) return;

  try {
    const ctx = requireChatContext();
    const connection = await ensureChatHubConnection();
    if (connection?.state !== signalR.HubConnectionState.Connected) return;
    await connection.invoke(
      "JoinGroupChat",
      parsed,
      ctx.orgId,
      ctx.appId,
      ctx.fiscalYearId
    );
  } catch {
    // Live group delivery is best-effort; history still loads via REST.
  }
};

/** Leave SignalR group:{groupId} (does not change DB membership). */
export const leaveChatGroupHub = async (groupId) => {
  const parsed = Number(groupId);
  if (!Number.isFinite(parsed) || parsed <= 0) return;

  try {
    const connection = await ensureChatHubConnection();
    if (connection?.state !== signalR.HubConnectionState.Connected) return;
    await connection.invoke("LeaveGroupChat", parsed);
  } catch {
    // Ignore — connection may already be down.
  }
};

/** Ack delivery to sender via the shared ChatHub (online !== read). */
export const ackChatMessageDelivered = async (messageId, senderUserId, chatId) => {
  const parsedMessageId = Number(messageId);
  const parsedSenderId = Number(senderUserId);
  const parsedChatId = Number(chatId);
  if (
    !Number.isFinite(parsedMessageId) ||
    parsedMessageId <= 0 ||
    !Number.isFinite(parsedSenderId) ||
    parsedSenderId <= 0 ||
    !Number.isFinite(parsedChatId) ||
    parsedChatId <= 0
  ) {
    return;
  }

  try {
    const connection = await ensureChatHubConnection();
    if (connection?.state !== signalR.HubConnectionState.Connected) return;
    await connection.invoke(
      "AckMessageDelivered",
      parsedMessageId,
      parsedSenderId,
      parsedChatId
    );
  } catch {
    // Delivery ack is best-effort; presence still upgrades ticks when peer is online.
  }
};

export const stopChatHubConnection = async () => {
  const connection = chatHubConnection;
  chatHubConnection = null;
  chatHubStartPromise = null;
  if (!connection) return;
  try {
    await connection.stop();
  } catch {
    // ignore stop errors on logout
  }
};

/**
 * SoftOnCloud Authentication API
 * POST /api/auth/login
 * Body: { orgId, email, password, rememberMe }
 */
export const postAuthLogin = (data) => {
  const orgIdRaw = data.orgId ?? data.organizationId;
  const orgIdParsed = parseInt(String(orgIdRaw ?? "").trim(), 10);
  const orgId = Number.isFinite(orgIdParsed) ? orgIdParsed : String(orgIdRaw ?? "").trim();

  return api.create(url.POST_AUTH_LOGIN, {
    orgId,
    email: data.email,
    password: data.password,
    rememberMe: Boolean(data.rememberMe),
  });
};

/**
 * SoftOnCloud Authorization API (ResolveUserContext)
 * GET /api/auth/resolve-context?productId={productId}
 * Auth: Bearer JWT
 */
export const resolveUserContext = (productId) =>
  api.get(url.GET_AUTH_RESOLVE_CONTEXT, { productId });

/**
 * SoftOnCloud Product Connection API
 * GET /api/auth/product-connection?productId={productId}
 * Auth: Bearer JWT (set after login via setAuthorization)
 * Query only — no request body.
 *
 * Success response includes:
 * productId, productCode, productName, dbGroup, resolvedConnectionString, fromCache
 */
export const getProductConnection = (productId) =>
  api.get(url.GET_AUTH_PRODUCT_CONNECTION, { productId });

/**
 * SoftOnCloud pricing plans for a product.
 * GET /api/pricing/plans?productId={productId}
 */
export const getPricingPlans = (productId) =>
  api.get(url.GET_PRICING_PLANS, { productId });

/**
 * SoftOnCloud payment initiate (activates/renews plan entitlement).
 * POST /api/payment/initiate
 * Auth: Bearer JWT
 * Body: { planProductId, billingCycle? }
 */
export const initiatePayment = (data) =>
  api.create(url.POST_PAYMENT_INITIATE, {
    planProductId: Number(data.planProductId),
    ...(data.billingCycle ? { billingCycle: data.billingCycle } : {}),
  });

const pickPlanProductId = (plan) =>
  Number(plan?.planProductId ?? plan?.plan_product_id ?? 0);

const isOnlinePurchasablePlan = (plan) => {
  if (!plan || typeof plan !== "object") return false;
  const flags = [
    plan.isAvailableForOnlinePurchase,
    plan.is_available_for_online_purchase,
    plan.availableForOnlinePurchase,
    plan.allowOnlinePurchase,
    plan.canPurchaseOnline,
  ];
  for (const flag of flags) {
    if (flag === false || flag === "false" || flag === 0) return false;
  }
  return true;
};

const rankPlanCandidates = (pricing) => {
  const list = Array.isArray(pricing) ? pricing : [];
  return list
    .map((plan, index) => {
      const planProductId = pickPlanProductId(plan);
      if (!Number.isFinite(planProductId) || planProductId <= 0) return null;
      if (!isOnlinePurchasablePlan(plan)) return null;

      let score = 0;
      if (plan.isIncludedFree === true || plan.is_included_free === true) score += 100;
      if (plan.isDefault === true || plan.is_default === true) score += 50;
      if (Number(plan.currentPrice ?? plan.monthlyPrice ?? 0) === 0) score += 25;
      return { plan, planProductId, score, index };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.index - b.index);
};

/**
 * When SoftOnCloud returns subscription_expired, reactivate a free/default
 * included plan via Payment API. Tries multiple candidate plans if needed.
 */
export const tryReactivateIncludedPlan = async (productId) => {
  const plansResponse = await getPricingPlans(productId);
  const pricing = Array.isArray(plansResponse?.pricing)
    ? plansResponse.pricing
    : Array.isArray(plansResponse?.Pricing)
      ? plansResponse.Pricing
      : [];

  const candidates = rankPlanCandidates(pricing);
  if (!candidates.length) {
    throw new Error(
      "No free/default SoftOnCloud plan found to renew this product subscription."
    );
  }

  let lastError = null;
  for (const candidate of candidates) {
    const billingCycle =
      candidate.plan?.billingCycle ||
      candidate.plan?.billing_cycle ||
      "yearly";
    try {
      await initiatePayment({
        planProductId: candidate.planProductId,
        billingCycle,
      });
      return true;
    } catch (error) {
      lastError = error;
      const message = String(error?.message || error?.data || "");
      if (/not available for online purchase/i.test(message)) {
        continue;
      }
      throw error;
    }
  }

  throw (
    lastError ||
    new Error("Selected plan is not available for online purchase.")
  );
};

/** Dev/local: allow chat login when SoftOnCloud subscription renew fails. */
export const allowExpiredSubscriptionLogin = () =>
  String(process.env.REACT_APP_ALLOW_EXPIRED_SUBSCRIPTION || "")
    .trim()
    .toLowerCase() === "true";

export const isSubscriptionExpiredError = (error) => {
  const reason =
    error?.denialReason ||
    error?.data?.denialReason ||
    error?.data?.DenialReason;
  const message = String(
    error?.message || error?.data?.message || error?.data || ""
  );
  return (
    reason === "subscription_expired" ||
    message.includes("subscription_expired") ||
    /subscription for this product has expired/i.test(message) ||
    /not available for online purchase/i.test(message)
  );
};

/**
 * Keep Product Connection metadata for the UI session.
 * Never persist resolvedConnectionString in browser storage.
 */
export const sanitizeProductConnection = (productConnection) => {
  if (!productConnection || typeof productConnection !== "object") {
    return null;
  }

  const {
    resolvedConnectionString: _secret,
    ...safeFields
  } = productConnection;

  return {
    ...safeFields,
    connectionReady: Boolean(productConnection.resolvedConnectionString),
  };
};

/**
 * SoftOnCloud Countries API
 * GET /api/auth/countries
 */
export const getCountries = () => api.get(url.GET_AUTH_COUNTRIES);

/**
 * Optional SoftOnCloud password-reset APIs
 */
export const postAuthForgotPassword = (data) =>
  api.create(url.POST_AUTH_FORGOT_PASSWORD, data);

export const postAuthVerifyPasswordResetOtp = (data) =>
  api.create(url.POST_AUTH_VERIFY_PASSWORD_RESET_OTP, data);

export const postAuthResendPasswordResetOtp = (data) =>
  api.create(url.POST_AUTH_RESEND_PASSWORD_RESET_OTP, data);

export const postAuthResetPassword = (data) =>
  api.create(url.POST_AUTH_RESET_PASSWORD, data);

export const getConfiguredProductId = () => {
  const fromEnv = appConfig.PRODUCT_ID || process.env.REACT_APP_PRODUCT_ID || "";
  const parsed = parseInt(String(fromEnv).trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const getAuthSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem("authUser")) || null;
  } catch {
    return null;
  }
};

/**
 * SoftOnCloud public org id used in organisation APIs.
 * Prefer values from login / resolve-context session / JWT claims.
 */
export const getOrgIdFromToken = (token) => {
  if (!token || typeof token !== "string") return null;
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded));
    const candidates = [
      payload.publicOrgId,
      payload.orgId,
      payload.organizationId,
      payload.organisationId,
      payload.OrgId,
      payload.OrganizationId,
      payload.org_id,
      payload.public_org_id,
    ];
    for (const value of candidates) {
      if (value === null || value === undefined || value === "") continue;
      return String(value).trim();
    }
  } catch {
    // ignore invalid token payload
  }
  return null;
};

export const getSessionPublicOrgId = () => {
  const session = getAuthSession();
  const token =
    session?.token ||
    session?.accessToken ||
    localStorage.getItem("authToken") ||
    null;

  const candidates = [
    session?.publicOrgId,
    session?.orgId,
    session?.organizationId,
    session?.organisationId,
    session?.loginOrgId,
    session?.user?.publicOrgId,
    session?.user?.orgId,
    session?.user?.organizationId,
    session?.productContext?.publicOrgId,
    session?.productContext?.orgId,
    session?.productContext?.organizationId,
    session?.productContext?.organisationId,
    session?.productConnection?.publicOrgId,
    session?.productConnection?.orgId,
    getOrgIdFromToken(token),
    process.env.REACT_APP_PUBLIC_ORG_ID,
  ];

  for (const value of candidates) {
    if (value === null || value === undefined || value === "") continue;
    return String(value).trim();
  }
  return null;
};

const decodeJwtPayload = (token) => {
  if (!token || typeof token !== "string") return {};
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return {};
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    return JSON.parse(atob(padded)) || {};
  } catch {
    return {};
  }
};

const firstPositiveNumber = (...candidates) => {
  for (const value of candidates) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
};

export const getSessionUserIdentity = () => {
  const session = getAuthSession();
  const token =
    session?.token ||
    session?.accessToken ||
    localStorage.getItem("authToken") ||
    null;

  const tokenUser = decodeJwtPayload(token);

  const email = String(
    session?.email ||
      session?.user?.email ||
      session?.productContext?.email ||
      tokenUser.email ||
      ""
  )
    .trim()
    .toLowerCase();

  const userId = firstPositiveNumber(
    session?.userId,
    session?.id,
    session?.productContext?.userId,
    session?.user?.userId,
    tokenUser.userId,
    tokenUser.userid,
    tokenUser.user_id,
    tokenUser.sub,
    tokenUser.uid
  );

  const displayName =
    session?.displayName ||
    session?.name ||
    session?.user?.displayName ||
    session?.productContext?.displayName ||
    [session?.firstName, session?.lastName].filter(Boolean).join(" ") ||
    tokenUser.displayName ||
    tokenUser.name ||
    email ||
    "You";

  const profileImage =
    session?.profileImageUrl ||
    session?.profileImage ||
    session?.avatarUrl ||
    session?.user?.profileImageUrl ||
    session?.user?.profileImage ||
    session?.user?.avatarUrl ||
    tokenUser.profileImageUrl ||
    tokenUser.profileImage ||
    tokenUser.avatarUrl ||
    null;

  return {
    userId,
    email,
    displayName,
    phone: session?.phone || session?.user?.phone || tokenUser.phone || null,
    phoneCountryCode:
      session?.phoneCountryCode ||
      session?.phone_country_code ||
      session?.user?.phoneCountryCode ||
      null,
    role:
      session?.roleNames?.[0] ||
      session?.productContext?.roleNames?.[0] ||
      session?.jobTitle ||
      "Me",
    jobTitle: session?.jobTitle || session?.user?.jobTitle || null,
    department: session?.department || session?.user?.department || null,
    location:
      session?.location ||
      session?.user?.location ||
      session?.city ||
      session?.user?.city ||
      session?.address ||
      session?.user?.address ||
      null,
    // Prefer SoftOnCloud session / JWT image only (GET /api/profile updates this).
    profileImage: profileImage || null,
  };
};

/**
 * Tenant + identity for Chat_Api calls (orgId, appId, fiscalYearId, userId).
 * All values come from login session / JWT / product config — nothing hardcoded.
 * Resolved tenant is cached in sessionStorage so refresh uses the same scope.
 */
export const getChatApiContext = () => {
  const session = getAuthSession();
  const token =
    session?.token ||
    session?.accessToken ||
    localStorage.getItem("authToken") ||
    null;
  const claims = decodeJwtPayload(token);
  const me = getSessionUserIdentity();

  let cachedTenant = null;
  try {
    cachedTenant = JSON.parse(sessionStorage.getItem("chatTenant") || "null");
  } catch {
    cachedTenant = null;
  }

  const orgId = firstPositiveNumber(
    cachedTenant?.orgId,
    getSessionPublicOrgId(),
    session?.publicOrgId,
    session?.orgId,
    session?.organizationId,
    session?.loginOrgId,
    session?.productContext?.orgId,
    session?.productContext?.organizationId,
    session?.productContext?.publicOrgId,
    claims.orgId,
    claims.org_id,
    claims.organizationId,
    claims.OrganisationId,
    claims.publicOrgId
  );

  const appId = firstPositiveNumber(
    cachedTenant?.appId,
    getConfiguredProductId(),
    session?.productContext?.productId,
    session?.productContext?.appId,
    session?.productConnection?.productId,
    claims.appId,
    claims.app_id,
    claims.productId,
    claims.product_id
  );

  const fiscalYearId = firstPositiveNumber(
    cachedTenant?.fiscalYearId,
    session?.fiscalYearId,
    session?.fiscal_year_id,
    session?.currentFiscalYearId,
    session?.activeFiscalYearId,
    session?.productContext?.fiscalYearId,
    session?.productContext?.fiscal_year_id,
    session?.productContext?.currentFiscalYearId,
    session?.productContext?.activeFiscalYearId,
    session?.productContext?.fyId,
    session?.productConnection?.fiscalYearId,
    session?.productConnection?.fiscal_year_id,
    session?.productConnection?.currentFiscalYearId,
    claims.fiscalYearId,
    claims.fiscal_year_id,
    claims.FiscalYearId,
    claims.currentFiscalYearId,
    claims.activeFiscalYearId,
    claims.fyId,
    new Date().getFullYear()
  );

  if (orgId && appId && fiscalYearId) {
    try {
      sessionStorage.setItem(
        "chatTenant",
        JSON.stringify({ orgId, appId, fiscalYearId })
      );
    } catch {
      // ignore
    }
  }

  return {
    token,
    userId: me.userId,
    orgId,
    appId,
    fiscalYearId,
  };
};

const getChatApiBaseUrl = () =>
  String(appConfig.CHAT_API_URL || process.env.REACT_APP_CHAT_API_URL || "")
    .trim()
    .replace(/\/$/, "");

/** Build absolute URL for a chat attachment web path (e.g. /chat-attachments/...). */
export const resolveChatAttachmentUrl = (relativePath) => {
  const path = String(relativePath || "").trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = getChatApiBaseUrl();
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

const requireChatContext = () => {
  const ctx = getChatApiContext();
  if (!ctx.token) {
    throw new Error("Authentication token missing. Please sign in again.");
  }
  if (!ctx.userId) {
    throw new Error("Logged-in user id missing from session/JWT.");
  }
  if (!ctx.orgId) {
    throw new Error("Organisation id missing from session/JWT.");
  }
  if (!ctx.appId) {
    throw new Error("Product/app id missing. Check REACT_APP_PRODUCT_ID.");
  }
  if (!ctx.fiscalYearId) {
    throw new Error("fiscalYearId could not be resolved from session/JWT.");
  }
  if (!getChatApiBaseUrl()) {
    throw new Error("Chat API URL is not configured (REACT_APP_CHAT_API_URL).");
  }
  return ctx;
};

const tenantQuery = (ctx) => ({
  orgId: ctx.orgId,
  appId: ctx.appId,
  fiscalYearId: ctx.fiscalYearId,
});

const unwrapChatList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.messages)) return response.messages;
  return [];
};

const chatAuthHeaders = (ctx) => {
  setAuthorization(ctx.token);
  return {
    Authorization: `Bearer ${ctx.token}`,
    "Content-Type": "application/json",
  };
};

const rethrowChatError = (error) => {
  if (error?.status === 401) {
    throw {
      ...error,
      message:
        "Session expired or Chat API rejected the token. Please sign in again.",
    };
  }
  throw error;
};

/** GET /api/chat/private/{user1Id}/{user2Id} */
export const getOrCreatePrivateChat = async (user1Id, user2Id) => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const params = tenantQuery(ctx);
  const query = Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");

  try {
    return await axios.get(
      `${base}${url.CHAT_PRIVATE}/${user1Id}/${user2Id}?${query}`,
      { headers: chatAuthHeaders(ctx) }
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** GET /api/chat/{chatId}/messages?orgId&appId&fiscalYearId */
export const getChatMessages = async (chatId) => {
  const parsedChatId = Number(chatId);
  if (!Number.isFinite(parsedChatId) || parsedChatId <= 0) {
    throw new Error("chatId is required to load messages.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const params = tenantQuery(ctx);
  const query = Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");

  try {
    const response = await axios.get(
      `${base}${url.CHAT_BY_ID}/${parsedChatId}/messages?${query}`,
      { headers: chatAuthHeaders(ctx) }
    );
    return unwrapChatList(response);
  } catch (error) {
    rethrowChatError(error);
  }
};

/** Fallback only when attachment-limits API is unavailable (backend default is also 60). */
export const DEFAULT_CHAT_MAX_FILE_SIZE_MB = 60;

/** GET /api/chat/attachments/limits — ChatMaxFileSizeMB from organisation settings. */
export const getChatAttachmentLimits = async () => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const params = tenantQuery(ctx);
  const query = Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");

  try {
    const response = await axios.get(
      `${base}${url.CHAT_ATTACHMENTS_LIMITS}?${query}`,
      { headers: chatAuthHeaders(ctx) }
    );
    const maxFileSizeMB = Number(
      response?.maxFileSizeMB ?? response?.MaxFileSizeMB ?? DEFAULT_CHAT_MAX_FILE_SIZE_MB
    );
    return {
      maxFileSizeMB:
        Number.isFinite(maxFileSizeMB) && maxFileSizeMB > 0
          ? maxFileSizeMB
          : DEFAULT_CHAT_MAX_FILE_SIZE_MB,
      maxBytes: Number(
        response?.maxBytes ??
          response?.MaxBytes ??
          maxFileSizeMB * 1024 * 1024
      ),
    };
  } catch (error) {
    rethrowChatError(error);
  }
};

/** POST /api/chat/attachments/upload — saves files to disk, returns paths (no DB write). */
export const uploadChatAttachments = async (files) => {
  const list = (Array.isArray(files) ? files : [files]).filter(Boolean);
  if (!list.length) {
    throw new Error("At least one file is required.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const params = tenantQuery(ctx);
  const query = Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");
  const form = new FormData();
  list.forEach((file) => form.append("files", file));

  try {
    return await axios.post(
      `${base}${url.CHAT_ATTACHMENTS_UPLOAD}?${query}`,
      form,
      {
        headers: {
          ...chatAuthHeaders(ctx),
          "Content-Type": "multipart/form-data",
        },
      }
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/**
 * GET /api/chat/attachments/download?path=...
 * Returns a Blob for a real browser download (avoids static-file CORS issues).
 */
export const fetchChatAttachmentBlob = async (relativePath) => {
  const path = String(relativePath || "").trim();
  if (!path) {
    throw new Error("Attachment path is required.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();

  const readBlobErrorMessage = async (blob, fallback = "Download failed.") => {
    if (!(blob instanceof Blob)) return fallback;
    try {
      const text = await blob.text();
      const parsed = JSON.parse(text);
      return parsed?.message || fallback;
    } catch {
      return fallback;
    }
  };

  try {
    const blob = await axios.get(`${base}${url.CHAT_ATTACHMENTS_DOWNLOAD}`, {
      params: { path },
      headers: chatAuthHeaders(ctx),
      responseType: "blob",
    });

    if (!(blob instanceof Blob)) {
      throw new Error("Invalid download response.");
    }

    // API errors may arrive as JSON inside a Blob when responseType is blob.
    if (blob.type && blob.type.includes("application/json")) {
      throw new Error(await readBlobErrorMessage(blob));
    }

    return blob;
  } catch (error) {
    if (error?.data instanceof Blob) {
      const message = await readBlobErrorMessage(error.data, error.message);
      rethrowChatError({ ...error, message });
    }
    rethrowChatError(error);
  }
};

/** POST /api/chat/{chatId}/messages */
export const sendChatMessage = async (
  chatId,
  {
    receiverUserId,
    messageBody,
    messageTypeId = 1,
    attachmentPath1 = null,
    attachmentPath2 = null,
    attachmentPath3 = null,
    attachmentPath4 = null,
    attachmentPath5 = null,
    parentMessageId = null,
    groupId = null,
  }
) => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);

  const body = {
    orgId: tenant.orgId,
    appId: tenant.appId,
    fiscalYearId: tenant.fiscalYearId,
    senderUserId: ctx.userId,
    messageBody,
    messageTypeId,
  };

  const parsedReceiver = Number(receiverUserId);
  if (Number.isFinite(parsedReceiver) && parsedReceiver > 0) {
    body.receiverUserId = parsedReceiver;
  }

  const parsedGroupId = Number(groupId);
  if (Number.isFinite(parsedGroupId) && parsedGroupId > 0) {
    body.groupId = parsedGroupId;
  }

  if (attachmentPath1) body.attachmentPath1 = attachmentPath1;
  if (attachmentPath2) body.attachmentPath2 = attachmentPath2;
  if (attachmentPath3) body.attachmentPath3 = attachmentPath3;
  if (attachmentPath4) body.attachmentPath4 = attachmentPath4;
  if (attachmentPath5) body.attachmentPath5 = attachmentPath5;
  const parsedParent = Number(parentMessageId);
  if (Number.isFinite(parsedParent) && parsedParent > 0) {
    body.parentMessageId = parsedParent;
  }

  const query = Object.keys(tenant)
    .map((key) => `${key}=${encodeURIComponent(tenant[key])}`)
    .join("&");

  try {
    return await axios.post(
      `${base}${url.CHAT_BY_ID}/${chatId}/messages?${query}`,
      body,
      { headers: chatAuthHeaders(ctx) }
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

const unwrapGroupList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.groups)) return response.groups;
  return [];
};

const chatTenantRequestConfig = (ctx) => ({
  headers: chatAuthHeaders(ctx),
  params: tenantQuery(ctx),
});

/** GET /api/chat/groups — active groups for the authenticated user. */
export const getChatGroups = async () => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    const response = await axios.get(`${base}${url.CHAT_GROUPS}`, chatTenantRequestConfig(ctx));
    return unwrapGroupList(response);
  } catch (error) {
    rethrowChatError(error);
  }
};

/** GET /api/chat/groups/{groupId} */
export const getChatGroupDetails = async (groupId) => {
  const parsed = Number(groupId);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("groupId is required.");
  }
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    return await axios.get(
      `${base}${url.CHAT_GROUPS}/${parsed}`,
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/**
 * POST /api/chat/groups
 * Body: { groupName, groupCode, description?, memberUserIds? }
 * Creator comes from JWT (do not send createdBy).
 */
export const createChatGroup = async ({
  groupName,
  groupCode,
  description = null,
  memberUserIds = [],
}) => {
  const name = String(groupName || "").trim();
  const code = String(groupCode || "").trim();
  if (!name) throw new Error("groupName is required.");
  if (!code) throw new Error("groupCode is required.");

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);
  const members = (Array.isArray(memberUserIds) ? memberUserIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  try {
    return await axios.post(
      `${base}${url.CHAT_GROUPS}`,
      {
        groupName: name,
        groupCode: code,
        description: description ? String(description).trim() : null,
        memberUserIds: members,
        orgId: tenant.orgId,
        appId: tenant.appId,
        fiscalYearId: tenant.fiscalYearId,
      },
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** PUT /api/chat/groups/{groupId} — admin updates name/description/profilePic. */
export const updateChatGroup = async (
  groupId,
  { groupName, description = null, profilePic = undefined }
) => {
  const parsed = Number(groupId);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("groupId is required.");
  }
  const name = String(groupName || "").trim();
  if (!name) throw new Error("groupName is required.");

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);

  const body = {
    groupName: name,
    description: description ? String(description).trim() : null,
    orgId: tenant.orgId,
    appId: tenant.appId,
    fiscalYearId: tenant.fiscalYearId,
  };

  // undefined = omit (SQL leaves existing); null/"" = clear; string = set path/URL
  if (profilePic !== undefined) {
    body.profilePic =
      profilePic == null || profilePic === ""
        ? ""
        : String(profilePic).trim();
  }

  try {
    return await axios.put(
      `${base}${url.CHAT_GROUPS}/${parsed}`,
      body,
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/**
 * POST /api/chat/groups/{groupId}/members
 * Body uses memberUserIds (backend contract).
 */
export const addChatGroupMembers = async (groupId, memberUserIds) => {
  const parsed = Number(groupId);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("groupId is required.");
  }
  const members = (Array.isArray(memberUserIds) ? memberUserIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (!members.length) throw new Error("memberUserIds is required.");

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);

  try {
    return await axios.post(
      `${base}${url.CHAT_GROUPS}/${parsed}/members`,
      {
        memberUserIds: members,
        orgId: tenant.orgId,
        appId: tenant.appId,
        fiscalYearId: tenant.fiscalYearId,
      },
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** DELETE /api/chat/groups/{groupId}/members/{targetUserId} */
export const removeChatGroupMember = async (groupId, targetUserId) => {
  const parsedGroup = Number(groupId);
  const parsedUser = Number(targetUserId);
  if (!Number.isFinite(parsedGroup) || parsedGroup <= 0) {
    throw new Error("groupId is required.");
  }
  if (!Number.isFinite(parsedUser) || parsedUser <= 0) {
    throw new Error("targetUserId is required.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();

  try {
    return await axios.delete(
      `${base}${url.CHAT_GROUPS}/${parsedGroup}/members/${parsedUser}`,
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** POST /api/chat/groups/{groupId}/leave — current JWT user leaves. */
export const leaveChatGroup = async (groupId) => {
  const parsed = Number(groupId);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("groupId is required.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();

  try {
    return await axios.post(
      `${base}${url.CHAT_GROUPS}/${parsed}/leave`,
      {},
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/**
 * PUT /api/chat/groups/{groupId}/members/{targetUserId}/admin
 * Body: { isAdmin: true | false } — WhatsApp-style multi-admin.
 */
export const setChatGroupMemberAdmin = async (
  groupId,
  targetUserId,
  isAdmin = true
) => {
  const parsedGroup = Number(groupId);
  const parsedUser = Number(targetUserId);
  if (!Number.isFinite(parsedGroup) || parsedGroup <= 0) {
    throw new Error("groupId is required.");
  }
  if (!Number.isFinite(parsedUser) || parsedUser <= 0) {
    throw new Error("targetUserId is required.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);

  try {
    return await axios.put(
      `${base}${url.CHAT_GROUPS}/${parsedGroup}/members/${parsedUser}/admin`,
      {
        isAdmin: Boolean(isAdmin),
        orgId: tenant.orgId,
        appId: tenant.appId,
        fiscalYearId: tenant.fiscalYearId,
      },
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/**
 * POST /api/chat/messages/{messageId}/forward
 * Inserts a NEW tab_messages row with forwarded_from_message_id + forwarded_by.
 */
export const forwardChatMessage = async (
  messageId,
  { destinationChatId, receiverUserId, groupId }
) => {
  const parsedMessageId = Number(messageId);
  if (!Number.isFinite(parsedMessageId) || parsedMessageId <= 0) {
    throw new Error("messageId is required to forward a message.");
  }
  const parsedChatId = Number(destinationChatId);
  if (!Number.isFinite(parsedChatId) || parsedChatId <= 0) {
    throw new Error("destinationChatId is required to forward a message.");
  }

  const parsedGroupId = Number(groupId);
  const isGroup = Number.isFinite(parsedGroupId) && parsedGroupId > 0;
  const parsedReceiverId = Number(receiverUserId);
  if (!isGroup && (!Number.isFinite(parsedReceiverId) || parsedReceiverId <= 0)) {
    throw new Error("receiverUserId is required to forward a message.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);
  const query = Object.keys(tenant)
    .map((key) => `${key}=${encodeURIComponent(tenant[key])}`)
    .join("&");

  const body = {
    destinationChatId: parsedChatId,
    orgId: tenant.orgId,
    appId: tenant.appId,
    fiscalYearId: tenant.fiscalYearId,
  };
  if (isGroup) {
    body.groupId = parsedGroupId;
  } else {
    body.receiverUserId = parsedReceiverId;
  }

  try {
    return await axios.post(
      `${base}${url.CHAT_MESSAGE_FORWARD}/${parsedMessageId}/forward?${query}`,
      body,
      { headers: chatAuthHeaders(ctx) }
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/**
 * DELETE /api/chat/messages/{messageId}
 * Soft-deletes the message (delete_flag = 1) for everyone.
 */
export const deleteChatMessage = async (messageId) => {
  const parsedMessageId = Number(messageId);
  if (!Number.isFinite(parsedMessageId) || parsedMessageId <= 0) {
    throw new Error("messageId is required to delete a message.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);
  const query = Object.keys(tenant)
    .map((key) => `${key}=${encodeURIComponent(tenant[key])}`)
    .join("&");

  try {
    return await axios.delete(
      `${base}${url.CHAT_MESSAGE_DELETE}/${parsedMessageId}?${query}`,
      { headers: chatAuthHeaders(ctx) }
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/**
 * POST /api/chat/{chatId}/clear
 * Soft-clears all messages in the chat (delete_flag = 1).
 */
export const clearChat = async (chatId) => {
  const parsedChatId = Number(chatId);
  if (!Number.isFinite(parsedChatId) || parsedChatId <= 0) {
    throw new Error("chatId is required to clear a chat.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);
  const query = Object.keys(tenant)
    .map((key) => `${key}=${encodeURIComponent(tenant[key])}`)
    .join("&");

  try {
    return await axios.post(
      `${base}${url.CHAT_CLEAR}/${parsedChatId}/clear?${query}`,
      {},
      { headers: chatAuthHeaders(ctx) }
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/**
 * DELETE /api/chat/{chatId}
 * Soft-deletes all messages in the chat (delete_flag = 1).
 */
export const deleteChat = async (chatId) => {
  const parsedChatId = Number(chatId);
  if (!Number.isFinite(parsedChatId) || parsedChatId <= 0) {
    throw new Error("chatId is required to delete a chat.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);
  const query = Object.keys(tenant)
    .map((key) => `${key}=${encodeURIComponent(tenant[key])}`)
    .join("&");

  try {
    return await axios.delete(
      `${base}${url.CHAT_DELETE}/${parsedChatId}?${query}`,
      { headers: chatAuthHeaders(ctx) }
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** POST /api/chat/messages/{messageId}/star — personal star for current user. */
export const toggleChatMessageStar = async (messageId, isStarred) => {
  const parsedMessageId = Number(messageId);
  if (!Number.isFinite(parsedMessageId) || parsedMessageId <= 0) {
    throw new Error("messageId is required to star a message.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);
  const query = Object.keys(tenant)
    .map((key) => `${key}=${encodeURIComponent(tenant[key])}`)
    .join("&");

  try {
    return await axios.post(
      `${base}${url.CHAT_MESSAGE_STAR}/${parsedMessageId}/star?${query}`,
      { isStarred: Boolean(isStarred) },
      { headers: chatAuthHeaders(ctx) }
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/**
 * POST /api/chat/messages/{messageId}/reaction
 * Saves current-user reaction to tab_message_reactions.
 * Pass reactionCode: LIKE | LOVE | LAUGH | WOW | SAD | THANKS
 * Pass null/empty to clear.
 */
export const toggleChatMessageReaction = async (messageId, reactionCode) => {
  const parsedMessageId = Number(messageId);
  if (!Number.isFinite(parsedMessageId) || parsedMessageId <= 0) {
    throw new Error("messageId is required to react to a message.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);
  const query = Object.keys(tenant)
    .map((key) => `${key}=${encodeURIComponent(tenant[key])}`)
    .join("&");

  const code =
    reactionCode == null || String(reactionCode).trim() === ""
      ? null
      : String(reactionCode).trim().toUpperCase();

  try {
    return await axios.post(
      `${base}${url.CHAT_MESSAGE_REACTION}/${parsedMessageId}/reaction?${query}`,
      { reactionCode: code },
      { headers: chatAuthHeaders(ctx) }
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/**
 * GET /api/chat/messages/{messageId}/reactions
 * WhatsApp-style: who reacted (tab_message_reactions).
 */
export const getChatMessageReactions = async (messageId) => {
  const parsedMessageId = Number(messageId);
  if (!Number.isFinite(parsedMessageId) || parsedMessageId <= 0) {
    throw new Error("messageId is required.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);
  const query = Object.keys(tenant)
    .map((key) => `${key}=${encodeURIComponent(tenant[key])}`)
    .join("&");

  try {
    return await axios.get(
      `${base}${url.CHAT_MESSAGES}/${parsedMessageId}/reactions?${query}`,
      { headers: chatAuthHeaders(ctx) }
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** GET /api/chat/unread-counts?orgId&appId&fiscalYearId — per-peer unread for chat list badges */
export const getChatUnreadCountsByPeer = async () => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const params = tenantQuery(ctx);
  const query = Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");

  try {
    const response = await axios.get(
      `${base}${url.CHAT_UNREAD_COUNTS}?${query}`,
      { headers: chatAuthHeaders(ctx) }
    );
    const rawItems = Array.isArray(response?.items)
      ? response.items
      : Array.isArray(response?.Items)
        ? response.Items
        : [];
    const items = rawItems
      .map((row) => ({
        peerUserId: String(row?.peerUserId ?? row?.PeerUserId ?? ""),
        unreadCount: Math.max(
          0,
          Number(row?.unreadCount ?? row?.UnreadCount ?? 0) || 0
        ),
      }))
      .filter((row) => row.peerUserId && row.unreadCount > 0);
    const totalUnread = Number(
      response?.totalUnread ?? response?.TotalUnread ?? items.reduce((s, r) => s + r.unreadCount, 0)
    );
    return {
      items,
      totalUnread: Number.isFinite(totalUnread) ? Math.max(0, totalUnread) : 0,
    };
  } catch (error) {
    rethrowChatError(error);
  }
};

/** Shared unread total for sidebar Messages badge (WhatsApp-style). */
let messagesUnreadTotal = 0;
const messagesUnreadListeners = new Set();

export const getMessagesUnreadTotal = () => messagesUnreadTotal;

export const setMessagesUnreadTotal = (value) => {
  const next = Math.max(0, Number(value) || 0);
  if (next === messagesUnreadTotal) return;
  messagesUnreadTotal = next;
  messagesUnreadListeners.forEach((listener) => {
    try {
      listener(messagesUnreadTotal);
    } catch {
      // ignore subscriber errors
    }
  });
};

export const subscribeMessagesUnreadTotal = (listener) => {
  if (typeof listener !== "function") return () => {};
  messagesUnreadListeners.add(listener);
  return () => messagesUnreadListeners.delete(listener);
};

export const sumChatListUnread = (chatList) =>
  (Array.isArray(chatList) ? chatList : []).reduce(
    (sum, chat) => sum + Math.max(0, Number(chat?.unread) || 0),
    0
  );

/** Shared unread total for sidebar Groups badge (same pattern as Messages). */
let groupsUnreadTotal = 0;
const groupsUnreadListeners = new Set();

export const getGroupsUnreadTotal = () => groupsUnreadTotal;

export const setGroupsUnreadTotal = (value) => {
  const next = Math.max(0, Number(value) || 0);
  if (next === groupsUnreadTotal) return;
  groupsUnreadTotal = next;
  groupsUnreadListeners.forEach((listener) => {
    try {
      listener(groupsUnreadTotal);
    } catch {
      // ignore subscriber errors
    }
  });
};

export const subscribeGroupsUnreadTotal = (listener) => {
  if (typeof listener !== "function") return () => {};
  groupsUnreadListeners.add(listener);
  return () => groupsUnreadListeners.delete(listener);
};

export const sumGroupListUnread = (groupList) =>
  (Array.isArray(groupList) ? groupList : []).reduce(
    (sum, group) => sum + Math.max(0, Number(group?.unread) || 0),
    0
  );

/** GET /api/chat/notifications?orgId&appId&fiscalYearId */
export const getChatNotifications = async () => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const params = tenantQuery(ctx);
  const query = Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");

  try {
    const response = await axios.get(
      `${base}${url.CHAT_NOTIFICATIONS}?${query}`,
      { headers: chatAuthHeaders(ctx) }
    );
    const notifications = Array.isArray(response?.notifications)
      ? response.notifications
      : Array.isArray(response?.Notifications)
        ? response.Notifications
        : Array.isArray(response)
          ? response
          : [];
    const unreadCount = Number(
      response?.unreadCount ?? response?.UnreadCount ?? 0
    );
    return {
      notifications,
      unreadCount: Number.isFinite(unreadCount) ? Math.max(0, unreadCount) : 0,
    };
  } catch (error) {
    rethrowChatError(error);
  }
};

/** POST /api/chat/notifications/{id}/read */
export const markChatNotificationRead = async (notificationId) => {
  const parsedId = Number(notificationId);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    throw new Error("notificationId is required.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const params = tenantQuery(ctx);
  const query = Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");

  try {
    const response = await axios.post(
      `${base}${url.CHAT_NOTIFICATIONS}/${parsedId}/read?${query}`,
      {},
      { headers: chatAuthHeaders(ctx) }
    );
    const unreadCount = Number(
      response?.unreadCount ?? response?.UnreadCount ?? 0
    );
    return {
      notifications: Array.isArray(response?.notifications)
        ? response.notifications
        : Array.isArray(response?.Notifications)
          ? response.Notifications
          : [],
      unreadCount: Number.isFinite(unreadCount) ? Math.max(0, unreadCount) : 0,
    };
  } catch (error) {
    rethrowChatError(error);
  }
};

/** POST /api/chat/{chatId}/messages/read — mark inbound messages read for the auth user. */
export const markChatMessagesRead = async (chatId) => {
  const parsedChatId = Number(chatId);
  if (!Number.isFinite(parsedChatId) || parsedChatId <= 0) {
    throw new Error("chatId is required to mark messages read.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const params = tenantQuery(ctx);
  const query = Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");

  try {
    const response = await axios.post(
      `${base}${url.CHAT_BY_ID}/${parsedChatId}/messages/read?${query}`,
      {},
      { headers: chatAuthHeaders(ctx) }
    );
    const messageIds = Array.isArray(response?.messageIds)
      ? response.messageIds
      : Array.isArray(response?.MessageIds)
        ? response.MessageIds
        : [];
    return {
      chatId: Number(response?.chatId ?? response?.ChatId ?? parsedChatId),
      readerUserId: Number(
        response?.readerUserId ?? response?.ReaderUserId ?? ctx.userId
      ),
      readAt: response?.readAt ?? response?.ReadAt ?? null,
      messageIds,
    };
  } catch (error) {
    rethrowChatError(error);
  }
};

/** GET /api/chat/messages/{messageId}/info — group Message Info (Read by / Delivered to). */
export const getChatMessageInfo = async (messageId) => {
  const parsedMessageId = Number(messageId);
  if (!Number.isFinite(parsedMessageId) || parsedMessageId <= 0) {
    throw new Error("messageId is required for message info.");
  }

  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);
  const query = Object.keys(tenant)
    .map((key) => `${key}=${encodeURIComponent(tenant[key])}`)
    .join("&");

  try {
    const response = await axios.get(
      `${base}${url.CHAT_MESSAGES}/${parsedMessageId}/info?${query}`,
      { headers: chatAuthHeaders(ctx) }
    );
    const rawMembers = Array.isArray(response?.members)
      ? response.members
      : Array.isArray(response?.Members)
        ? response.Members
        : [];
    return {
      messageId: Number(response?.messageId ?? response?.MessageId ?? parsedMessageId),
      chatId: Number(response?.chatId ?? response?.ChatId ?? 0),
      groupId: response?.groupId ?? response?.GroupId ?? null,
      senderUserId: Number(
        response?.senderUserId ?? response?.SenderUserId ?? 0
      ),
      sentAt: response?.sentAt ?? response?.SentAt ?? null,
      members: rawMembers.map((m) => ({
        userId: Number(m?.userId ?? m?.UserId ?? 0),
        deliveredAt: m?.deliveredAt ?? m?.DeliveredAt ?? null,
        readAt: m?.readAt ?? m?.ReadAt ?? null,
      })),
    };
  } catch (error) {
    rethrowChatError(error);
  }
};

/**
 * SoftOnCloud organisation product users
 * GET /api/organisations/{publicOrgId}/products/{productId}/users
 */
export const getOrganisationProductUsers = (orgId, productId) =>
  api.get(`${url.GET_ORGANISATION_PRODUCT_USERS}/${orgId}/products/${productId}/users`);

const pickProfileString = (...values) => {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

/** SoftOnCloud phone / phone_country_code columns are varchar(20). */
const PROFILE_PHONE_MAX_LEN = 20;
const PROFILE_PHONE_COUNTRY_CODE_MAX_LEN = 20;
/** SoftOnCloud DB stores profile_image_url as varchar(500). */
const PROFILE_IMAGE_URL_MAX_LEN = 500;

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Split stacked display values like "+91 +91 635948725" into
 * { phoneCountryCode: "+91", phone: "635948725" } and clamp to DB limits.
 */
export const normalizeProfilePhoneFields = (
  rawPhone,
  rawCountryCode = ""
) => {
  let input = String(rawPhone || "").trim();
  let code = String(rawCountryCode || "").trim();

  if (code && !code.startsWith("+")) {
    const digits = code.replace(/\D/g, "");
    code = digits ? `+${digits}` : "";
  }

  // Collapse repeated "+91 +91 ..." prefixes into one code + national number.
  const leadingCodes = input.match(/(?:\+\d{1,4}[\s-]*)+/);
  if (leadingCodes) {
    const codeMatches = leadingCodes[0].match(/\+\d{1,4}/g) || [];
    if (codeMatches.length) {
      if (!code) code = codeMatches[codeMatches.length - 1];
      input = input.slice(leadingCodes[0].length).trim();
    }
  }

  if (code) {
    const codeDigits = code.replace(/\D/g, "");
    if (codeDigits) {
      input = input
        .replace(new RegExp(`^(?:\\+?${escapeRegExp(codeDigits)}[\\s-]*)+`, "i"), "")
        .trim();
    }
  }

  let phone = input.replace(/\D/g, "");
  // If national number still starts with country digits, strip once.
  if (code) {
    const codeDigits = code.replace(/\D/g, "");
    if (codeDigits && phone.startsWith(codeDigits) && phone.length > codeDigits.length) {
      phone = phone.slice(codeDigits.length);
    }
  }

  if (code.length > PROFILE_PHONE_COUNTRY_CODE_MAX_LEN) {
    code = code.slice(0, PROFILE_PHONE_COUNTRY_CODE_MAX_LEN);
  }
  if (phone.length > PROFILE_PHONE_MAX_LEN) {
    phone = phone.slice(0, PROFILE_PHONE_MAX_LEN);
  }

  return { phone, phoneCountryCode: code };
};

/** Display helper — never double-prefix country code onto phone. */
export const formatProfilePhoneDisplay = (rawCountryCode, rawPhone) => {
  const { phone, phoneCountryCode } = normalizeProfilePhoneFields(
    rawPhone,
    rawCountryCode
  );
  if (!phone && !phoneCountryCode) return "";
  if (!phone) return phoneCountryCode;
  if (!phoneCountryCode) return phone;
  return `${phoneCountryCode} ${phone}`;
};

/** Normalize SoftOnCloud GET /api/profile (and nested) response shapes. */
export const normalizeSoftOnCloudProfile = (raw) => {
  const src =
    raw && typeof raw === "object"
      ? raw.data && typeof raw.data === "object"
        ? raw.data
        : raw.profile && typeof raw.profile === "object"
          ? raw.profile
          : raw.user && typeof raw.user === "object"
            ? { ...raw, ...raw.user }
            : raw
      : {};

  const firstName = pickProfileString(
    src.firstName,
    src.FirstName,
    src.first_name
  );
  const middleName = pickProfileString(
    src.middleName,
    src.MiddleName,
    src.middle_name
  );
  const lastName = pickProfileString(
    src.lastName,
    src.LastName,
    src.last_name
  );
  const displayName = pickProfileString(
    src.displayName,
    src.DisplayName,
    src.display_name,
    src.name,
    src.Name,
    [firstName, middleName, lastName].filter(Boolean).join(" ")
  );
  const phoneParts = normalizeProfilePhoneFields(
    pickProfileString(src.phone, src.Phone, src.phoneNumber, src.PhoneNumber),
    pickProfileString(
      src.phoneCountryCode,
      src.PhoneCountryCode,
      src.phone_country_code
    )
  );
  const phone = phoneParts.phone;
  const phoneCountryCode = phoneParts.phoneCountryCode;
  const email = pickProfileString(src.email, src.Email).toLowerCase();
  const jobTitle = pickProfileString(
    src.jobTitle,
    src.JobTitle,
    src.job_title,
    src.job,
    src.Job
  );
  const department = pickProfileString(
    src.department,
    src.Department
  );
  const location = pickProfileString(
    src.location,
    src.Location,
    src.city,
    src.City,
    src.address,
    src.Address
  );
  const profileImageUrl = pickProfileString(
    src.profileImageUrl,
    src.ProfileImageUrl,
    src.profile_image_url,
    src.profileImage,
    src.ProfileImage,
    src.avatarUrl,
    src.AvatarUrl,
    src.imageUrl,
    src.ImageUrl
  );
  const userId = firstPositiveNumber(
    src.userId,
    src.UserId,
    src.user_id,
    src.id,
    src.Id
  );

  return {
    userId,
    email,
    displayName,
    firstName,
    middleName,
    lastName,
    phone,
    phoneCountryCode,
    jobTitle,
    department,
    location,
    profileImageUrl: profileImageUrl || null,
    raw: src,
  };
};

/** Merge profile fields into auth session so refresh/header stay in sync. */
export const mergeProfileIntoAuthSession = (profile) => {
  const normalized =
    profile && typeof profile === "object" && profile.displayName !== undefined
      ? profile
      : normalizeSoftOnCloudProfile(profile);
  try {
    const session = getAuthSession() || {};
    const next = {
      ...session,
      email: normalized.email || session.email,
      displayName: normalized.displayName || session.displayName,
      name: normalized.displayName || session.name,
      firstName: normalized.firstName || session.firstName,
      lastName: normalized.lastName || session.lastName,
      phone: normalized.phone || session.phone,
      phoneCountryCode:
        normalized.phoneCountryCode || session.phoneCountryCode,
      jobTitle: normalized.jobTitle || session.jobTitle,
      department: normalized.department || session.department,
      location: normalized.location || session.location,
      profileImage: normalized.profileImageUrl || session.profileImage,
      avatarUrl: normalized.profileImageUrl || session.avatarUrl,
      profileImageUrl: normalized.profileImageUrl || session.profileImageUrl,
      user: {
        ...(session.user || {}),
        email: normalized.email || session.user?.email,
        displayName: normalized.displayName || session.user?.displayName,
        phone: normalized.phone || session.user?.phone,
        jobTitle: normalized.jobTitle || session.user?.jobTitle,
        department: normalized.department || session.user?.department,
        location: normalized.location || session.user?.location,
        profileImage: normalized.profileImageUrl || session.user?.profileImage,
        profileImageUrl:
          normalized.profileImageUrl || session.user?.profileImageUrl,
        avatarUrl: normalized.profileImageUrl || session.user?.avatarUrl,
      },
    };
    sessionStorage.setItem("authUser", JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
};

/** Build profile object from current auth session (no network). */
export const getProfileFromSession = () => {
  const me = getSessionUserIdentity();
  const session = getAuthSession() || {};
  return normalizeSoftOnCloudProfile({
    userId: me.userId,
    email: me.email,
    displayName: me.displayName,
    firstName: session.firstName || session.user?.firstName,
    lastName: session.lastName || session.user?.lastName,
    phone: me.phone,
    phoneCountryCode: me.phoneCountryCode,
    jobTitle: me.jobTitle || session.jobTitle,
    department: me.department,
    location: me.location,
    profileImageUrl: me.profileImage,
    profileImage: me.profileImage,
  });
};

/**
 * Format SoftOnCloud profile API errors for UI toasts.
 * Reports which endpoint failed; surfaces the API message as returned.
 */
export const formatProfileApiError = (error, apiLabel) => {
  const label = apiLabel || "Profile API";
  const data = error?.data;
  const fromData =
    (typeof data === "string" && data.trim()) ||
    data?.message ||
    data?.title ||
    data?.detail ||
    (Array.isArray(data?.errors) ? data.errors.join("; ") : null);
  const message = String(fromData || error?.message || "Request failed").trim();
  return `${label} failed: ${message}`;
};

/**
 * GET /api/profile — authenticated SoftOnCloud user profile (JWT).
 * No session/demo fallback — callers must handle errors.
 */
export const getSoftOnCloudProfile = async () => {
  const response = await api.get(url.GET_PROFILE);
  const profile = normalizeSoftOnCloudProfile(response);
  mergeProfileIntoAuthSession(profile);
  if (profile.profileImageUrl) {
    try {
      setCurrentUserProfileAvatar(profile.profileImageUrl);
    } catch {
      // optional local cache after successful API response
    }
  }
  return profile;
};

/**
 * PUT /api/profile — SoftOnCloud UpdateUserProfileRequest
 * (additionalProperties: false — do not send email/location/userId).
 */
export const updateSoftOnCloudProfile = async (fields = {}) => {
  const current = getProfileFromSession();
  const displayName = pickProfileString(
    fields.displayName,
    fields.display_name,
    fields.name,
    current.displayName
  );
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const firstName = pickProfileString(
    fields.firstName,
    fields.first_name,
    nameParts[0],
    current.firstName
  );
  const lastName = pickProfileString(
    fields.lastName,
    fields.last_name,
    nameParts.length > 1 ? nameParts[nameParts.length - 1] : "",
    current.lastName
  );
  const middleName = pickProfileString(
    fields.middleName,
    fields.middle_name,
    nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "",
    current.middleName
  );
  const phoneParts = normalizeProfilePhoneFields(
    pickProfileString(fields.phone, fields.Phone, current.phone),
    pickProfileString(
      fields.phoneCountryCode,
      fields.phone_country_code,
      current.phoneCountryCode
    )
  );
  const phone = phoneParts.phone;
  const phoneCountryCode = phoneParts.phoneCountryCode;
  const jobTitle = pickProfileString(
    fields.jobTitle,
    fields.job,
    fields.job_title,
    current.jobTitle
  );
  const department = pickProfileString(fields.department, current.department);
  const employeeCode = pickProfileString(
    fields.employeeCode,
    fields.employee_code,
    current.raw?.employee_code,
    current.raw?.employeeCode
  );
  let profileImageUrl = pickProfileString(
    fields.profileImageUrl,
    fields.profile_image_url,
    fields.profileImage,
    current.profileImageUrl
  );
  if (
    !profileImageUrl ||
    /^data:/i.test(profileImageUrl) ||
    profileImageUrl.length > PROFILE_IMAGE_URL_MAX_LEN
  ) {
    profileImageUrl = "";
  }

  // Exact SoftOnCloud swagger UpdateUserProfileRequest properties only.
  const payload = {
    first_name: firstName || null,
    middle_name: middleName || null,
    last_name: lastName || null,
    display_name: displayName || null,
    phone: phone || null,
    phone_country_code: phoneCountryCode || null,
    job_title: jobTitle || null,
    department: department || null,
    employee_code: employeeCode || null,
    profile_image_url: profileImageUrl || null,
  };

  const response = await api.put(url.UPDATE_PROFILE, payload);
  const profile = normalizeSoftOnCloudProfile(response?.data || response);
  const merged = {
    userId: profile.userId || current.userId,
    displayName: profile.displayName || displayName,
    firstName: profile.firstName || firstName,
    middleName: profile.middleName || middleName,
    lastName: profile.lastName || lastName,
    phone: profile.phone || phone,
    phoneCountryCode: profile.phoneCountryCode || phoneCountryCode,
    email: profile.email || current.email,
    jobTitle: profile.jobTitle || jobTitle,
    department: profile.department || department,
    location: profile.location || current.location,
    profileImageUrl: profile.profileImageUrl || profileImageUrl || null,
  };
  mergeProfileIntoAuthSession(merged);
  return merged;
};

/**
 * PUT /api/profile/image — update SoftOnCloud profile_image_url in database (JWT).
 * Body must match UpdateProfileImageRequest: { profile_image_url }.
 * For File input: upload via existing Chat attachments API first (short URL),
 * never send a data-URL (exceeds varchar(500)).
 */
export const updateSoftOnCloudProfileImage = async (fileOrUrl) => {
  let imageUrl = "";

  if (typeof File !== "undefined" && fileOrUrl instanceof File) {
    const uploaded = await uploadChatAttachments(fileOrUrl);
    const first =
      (Array.isArray(uploaded?.files) && uploaded.files[0]) ||
      (Array.isArray(uploaded?.Files) && uploaded.Files[0]) ||
      null;
    const rawPath = pickProfileString(
      first?.fileUrl,
      first?.FileUrl,
      first?.filePath,
      first?.FilePath,
      uploaded?.attachmentPath1,
      uploaded?.AttachmentPath1
    );
    imageUrl = /^https?:\/\//i.test(rawPath)
      ? rawPath
      : resolveChatAttachmentUrl(rawPath) || rawPath;
  } else {
    imageUrl = String(fileOrUrl || "").trim();
  }

  if (!imageUrl) throw new Error("Profile image is required.");
  if (/^data:/i.test(imageUrl)) {
    throw new Error(
      "Profile image must be a short URL (max 500 chars), not embedded image data."
    );
  }
  if (imageUrl.length > PROFILE_IMAGE_URL_MAX_LEN) {
    throw new Error(
      `Profile image URL is too long (${imageUrl.length}/${PROFILE_IMAGE_URL_MAX_LEN}).`
    );
  }

  const response = await api.put(url.UPDATE_PROFILE_IMAGE, {
    profile_image_url: imageUrl,
  });

  const profile = normalizeSoftOnCloudProfile(response?.data || response);
  const savedUrl =
    profile.profileImageUrl ||
    pickProfileString(
      response?.profileImageUrl,
      response?.profile_image_url,
      response?.url,
      imageUrl
    );

  if (!savedUrl) {
    throw new Error("Profile image URL missing from API response.");
  }

  mergeProfileIntoAuthSession({
    ...profile,
    profileImageUrl: savedUrl,
  });
  try {
    setCurrentUserProfileAvatar(savedUrl);
  } catch {
    // optional cache
  }
  return { ...profile, profileImageUrl: savedUrl };
};

/**
 * Persist SoftOnCloud login session for the UI.
 * Does not store resolvedConnectionString.
 */
export const storeAuthSession = (
  loginResponse,
  productContext = null,
  productConnection = null,
  extras = {}
) => {
  const token = loginResponse?.token || loginResponse?.accessToken || null;
  const loginOrgId =
    extras.organizationId ||
    extras.orgId ||
    extras.publicOrgId ||
    loginResponse?.publicOrgId ||
    loginResponse?.orgId ||
    loginResponse?.organizationId ||
    loginResponse?.organisationId ||
    productContext?.publicOrgId ||
    productContext?.orgId ||
    productContext?.organizationId ||
    getOrgIdFromToken(token) ||
    null;

  const session = {
    ...loginResponse,
    token,
    accessToken: loginResponse?.accessToken || token,
    productContext,
    productConnection: sanitizeProductConnection(productConnection),
    // Always keep org id for organisation APIs (users list, etc.)
    organizationId: loginOrgId,
    orgId: loginOrgId,
    publicOrgId: loginResponse?.publicOrgId || loginOrgId,
    loginOrgId,
  };

  sessionStorage.setItem("authUser", JSON.stringify(session));

  if (token) {
    localStorage.setItem("authToken", token);
    setAuthorization(token);
  }

  return session;
};

export const clearAuthSession = () => {
  stopChatHubConnection();
  sessionStorage.removeItem("authUser");
  sessionStorage.removeItem("chatTenant");
  sessionStorage.removeItem("chatUiState");
  localStorage.removeItem("authToken");
  delete axios.defaults.headers.common["Authorization"];
};

const PROFILE_AVATAR_STORAGE_KEY = "chatUserProfileAvatars";

const readProfileAvatarMap = () => {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_AVATAR_STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
};

/**
 * Profile image for a SoftOnCloud userId (persisted locally — SoftOnCloud
 * exposes no avatar upload endpoint in the current auth APIs).
 */
export const getStoredProfileAvatar = (userId) => {
  if (userId == null || userId === "") return null;
  const map = readProfileAvatarMap();
  const value = map[String(userId)];
  return typeof value === "string" && value.trim() ? value : null;
};

/**
 * Save the logged-in user's own profile picture only.
 * Validates ownership against the current JWT/session userId.
 */
export const setCurrentUserProfileAvatar = (dataUrl) => {
  const me = getSessionUserIdentity();
  if (!me?.userId) {
    throw new Error("Logged-in user id missing from session/JWT.");
  }
  if (typeof dataUrl !== "string" || !dataUrl.trim()) {
    throw new Error("Profile image data is required.");
  }

  const key = String(me.userId);
  const map = readProfileAvatarMap();
  map[key] = dataUrl;
  localStorage.setItem(PROFILE_AVATAR_STORAGE_KEY, JSON.stringify(map));

  try {
    const session = getAuthSession() || {};
    const next = {
      ...session,
      profileImage: dataUrl,
      avatarUrl: dataUrl,
      user: {
        ...(session.user || {}),
        profileImage: dataUrl,
        avatarUrl: dataUrl,
      },
    };
    sessionStorage.setItem("authUser", JSON.stringify(next));
  } catch {
    // ignore session write failures
  }

  return dataUrl;
};

/** Resolve avatar URL for any user: API field first, then local store for self. */
export const resolveUserAvatarUrl = (userId, apiAvatarUrl = null) => {
  const fromApi =
    typeof apiAvatarUrl === "string" && apiAvatarUrl.trim()
      ? apiAvatarUrl.trim()
      : null;
  if (fromApi) return fromApi;
  return getStoredProfileAvatar(userId);
};

// ─── Announcements (Chat_Api /api/announcements) ─────────────────────────────

const unwrapAnnouncementList = (response) => {
  const raw = response?.data ?? response;
  const items = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.Items)
      ? raw.Items
      : Array.isArray(raw)
        ? raw
        : [];
  return {
    items,
    page: Number(raw?.page ?? raw?.Page ?? 1),
    pageSize: Number(raw?.pageSize ?? raw?.PageSize ?? 10),
    totalCount: Number(raw?.totalCount ?? raw?.TotalCount ?? items.length),
  };
};

/** GET /api/announcements */
export const getAnnouncements = async (params = {}) => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    const response = await axios.get(`${base}${url.CHAT_ANNOUNCEMENTS}`, {
      ...chatTenantRequestConfig(ctx),
      params: { ...tenantQuery(ctx), ...params },
    });
    return unwrapAnnouncementList(response);
  } catch (error) {
    rethrowChatError(error);
  }
};

/** GET /api/announcements/{id} */
export const getAnnouncementById = async (announcementId) => {
  const id = Number(announcementId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("announcementId is required.");
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    return await axios.get(
      `${base}${url.CHAT_ANNOUNCEMENTS}/${id}`,
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** POST /api/announcements */
export const createAnnouncement = async (data) => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);
  try {
    return await axios.post(
      `${base}${url.CHAT_ANNOUNCEMENTS}`,
      {
        ...data,
        orgId: tenant.orgId,
        appId: tenant.appId,
        fiscalYearId: tenant.fiscalYearId,
      },
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** PUT /api/announcements/{id} */
export const updateAnnouncement = async (announcementId, data) => {
  const id = Number(announcementId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("announcementId is required.");
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const tenant = tenantQuery(ctx);
  try {
    return await axios.put(
      `${base}${url.CHAT_ANNOUNCEMENTS}/${id}`,
      {
        ...data,
        orgId: tenant.orgId,
        appId: tenant.appId,
        fiscalYearId: tenant.fiscalYearId,
      },
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** DELETE /api/announcements/{id} */
export const deleteAnnouncement = async (announcementId) => {
  const id = Number(announcementId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("announcementId is required.");
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    return await axios.delete(
      `${base}${url.CHAT_ANNOUNCEMENTS}/${id}`,
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** POST /api/announcements/{id}/read */
export const markAnnouncementRead = async (announcementId) => {
  const id = Number(announcementId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("announcementId is required.");
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    return await axios.post(
      `${base}${url.CHAT_ANNOUNCEMENTS}/${id}/read`,
      {},
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** POST /api/announcements/{id}/pin */
export const pinAnnouncement = async (announcementId) => {
  const id = Number(announcementId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("announcementId is required.");
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    return await axios.post(
      `${base}${url.CHAT_ANNOUNCEMENTS}/${id}/pin`,
      {},
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** POST /api/announcements/{id}/unpin */
export const unpinAnnouncement = async (announcementId) => {
  const id = Number(announcementId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("announcementId is required.");
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    return await axios.post(
      `${base}${url.CHAT_ANNOUNCEMENTS}/${id}/unpin`,
      {},
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** GET /api/announcement-categories */
export const getAnnouncementCategories = async () => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    const response = await axios.get(
      `${base}${url.CHAT_ANNOUNCEMENT_CATEGORIES}`,
      chatTenantRequestConfig(ctx)
    );
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  } catch (error) {
    rethrowChatError(error);
  }
};

/** GET /api/announcements/stats */
export const getAnnouncementStats = async () => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    return await axios.get(
      `${base}${url.CHAT_ANNOUNCEMENTS}/stats`,
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** GET /api/announcements/unread-count */
export const getUnreadAnnouncementCount = async () => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    const response = await axios.get(
      `${base}${url.CHAT_ANNOUNCEMENTS}/unread-count`,
      chatTenantRequestConfig(ctx)
    );
    return Number(response?.unreadCount ?? response?.UnreadCount ?? 0);
  } catch (error) {
    rethrowChatError(error);
  }
};

// ─── Settings (Chat_Api /api/settings) ───────────────────────────────────────

/** GET /api/settings */
export const getChatSettings = async () => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    return await axios.get(`${base}${url.CHAT_SETTINGS}`, chatTenantRequestConfig(ctx));
  } catch (error) {
    rethrowChatError(error);
  }
};

/** PUT /api/settings/profile?orgId&appId&fiscalYearId
 * Body: { fullName, phone, photoUrl, language, dateFormat }
 */
export const updateChatSettingsProfile = async (data) => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  const body = {
    fullName: String(data?.fullName ?? "").trim(),
    phone: data?.phone == null || String(data.phone).trim() === ""
      ? null
      : String(data.phone).trim(),
    photoUrl: data?.photoUrl == null || String(data.photoUrl).trim() === ""
      ? null
      : String(data.photoUrl).trim(),
    language: String(data?.language ?? "").trim(),
    dateFormat: String(data?.dateFormat ?? "").trim(),
  };
  try {
    return await axios.put(
      `${base}${url.CHAT_SETTINGS_PROFILE}`,
      body,
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** PUT /api/settings/status */
export const updateChatSettingsStatus = async (data) => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    return await axios.put(
      `${base}${url.CHAT_SETTINGS_STATUS}`,
      data,
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** PUT /api/settings/message-defaults */
export const updateChatSettingsMessageDefaults = async (data) => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    return await axios.put(
      `${base}${url.CHAT_SETTINGS_MESSAGE_DEFAULTS}`,
      data,
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** PUT /api/settings/notifications */
export const updateChatSettingsNotifications = async (data) => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    return await axios.put(
      `${base}${url.CHAT_SETTINGS_NOTIFICATIONS}`,
      data,
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** PUT /api/settings/privacy */
export const updateChatSettingsPrivacy = async (data) => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    return await axios.put(
      `${base}${url.CHAT_SETTINGS_PRIVACY}`,
      data,
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** GET /api/settings/storage */
export const getChatSettingsStorage = async () => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    return await axios.get(
      `${base}${url.CHAT_SETTINGS_STORAGE}`,
      chatTenantRequestConfig(ctx)
    );
  } catch (error) {
    rethrowChatError(error);
  }
};

/** GET /api/settings/integrations */
export const getChatSettingsIntegrations = async () => {
  const ctx = requireChatContext();
  const base = getChatApiBaseUrl();
  try {
    const response = await axios.get(
      `${base}${url.CHAT_SETTINGS_INTEGRATIONS}`,
      chatTenantRequestConfig(ctx)
    );
    return Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
  } catch (error) {
    rethrowChatError(error);
  }
};

// ─── Chat date format preference (Settings → Messages date chips) ─────────────

export const DEFAULT_CHAT_DATE_FORMAT = "DD MMM YYYY";
const CHAT_DATE_FORMAT_KEY = "chatDateFormat";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Persist date format from Settings (sessionStorage). */
export const setChatDateFormat = (format) => {
  const value = String(format || "").trim() || DEFAULT_CHAT_DATE_FORMAT;
  try {
    sessionStorage.setItem(CHAT_DATE_FORMAT_KEY, value);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent("chat-date-format-updated", { detail: { dateFormat: value } })
    );
  } catch {
    /* ignore */
  }
  return value;
};

/** Read saved date format (fallback DD MMM YYYY). */
export const getChatDateFormat = () => {
  try {
    const saved = String(sessionStorage.getItem(CHAT_DATE_FORMAT_KEY) || "").trim();
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_CHAT_DATE_FORMAT;
};

/**
 * Format a date using Settings preference.
 * Supported: DD MMM YYYY | MM/DD/YYYY | DD/MM/YYYY | YYYY-MM-DD
 */
export const formatDateByPreference = (value, format = getChatDateFormat()) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const dd = String(date.getDate()).padStart(2, "0");
  const d = String(date.getDate());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const m = String(date.getMonth() + 1);
  const yyyy = String(date.getFullYear());
  const mon = MONTH_SHORT[date.getMonth()];
  const pattern = String(format || DEFAULT_CHAT_DATE_FORMAT).trim();

  switch (pattern) {
    case "MM/DD/YYYY":
      return `${mm}/${dd}/${yyyy}`;
    case "DD/MM/YYYY":
      return `${dd}/${mm}/${yyyy}`;
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`;
    case "DD MMM YYYY":
    default:
      // Keep WhatsApp-like short day without leading zero when matching DD MMM YYYY
      if (pattern === "DD MMM YYYY") return `${d} ${mon} ${yyyy}`;
      return `${d} ${mon} ${yyyy}`;
  }
};
