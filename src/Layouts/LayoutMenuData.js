import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { buildCommunicationMenu } from "./CommunicationMenuData";
import {
  getMessagesUnreadTotal,
  setMessagesUnreadTotal,
  subscribeMessagesUnreadTotal,
  getGroupsUnreadTotal,
  setGroupsUnreadTotal,
  subscribeGroupsUnreadTotal,
  sumGroupListUnread,
  getChatUnreadCountsByPeer,
  getChatGroups,
  getSessionUserIdentity,
  subscribeChatPresence,
  ackChatMessageDelivered,
  resolveCanUseAllUserCommunication,
  getChatPermissionMenu,
  shouldShowAllUserCommunicationMenu,
} from "../helpers/softoncloud_auth_helper";
import { isProductAdminSession } from "../helpers/softoncloud_master_helper";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sidebar menu with unread badges + dynamic items from
 * tab_menu_master / tab_role_permission (GET /api/permissions/menu).
 */
export const useNavData = () => {
  const location = useLocation();
  const authUser = useSelector((state) => state.Login?.user);
  const sessionUserId = getSessionUserIdentity()?.userId;

  const [messagesUnread, setMessagesUnread] = useState(getMessagesUnreadTotal);
  const [groupsUnread, setGroupsUnread] = useState(getGroupsUnreadTotal);
  // Prefer session already warmed at login; avoid starting false then flipping after refresh only.
  const [showAllUserCommunication, setShowAllUserCommunication] = useState(() =>
    shouldShowAllUserCommunicationMenu()
  );
  const [permissionMenu, setPermissionMenu] = useState(null);
  const [isMasterOpen, setIsMasterOpen] = useState(() =>
    String(location.pathname || "").includes("/communication/master")
  );

  const onToggleMaster = useCallback(() => {
    setIsMasterOpen((open) => !open);
  }, []);

  // Keep Master dropdown open while on a Master page
  useEffect(() => {
    if (String(location.pathname || "").includes("/communication/master")) {
      setIsMasterOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => subscribeMessagesUnreadTotal(setMessagesUnread), []);
  useEffect(() => subscribeGroupsUnreadTotal(setGroupsUnread), []);

  // Resolve All User Communication eligibility; retry until session/context is ready.
  useEffect(() => {
    let cancelled = false;

    const resolveAuc = async () => {
      // Immediate session check (roles persisted from login / prior resolve)
      if (shouldShowAllUserCommunicationMenu()) {
        if (!cancelled) setShowAllUserCommunication(true);
      }

      const attempts = [0, 250, 600, 1200];
      for (const delay of attempts) {
        if (cancelled) return;
        if (delay) await sleep(delay);

        const me = getSessionUserIdentity();
        if (!me?.userId && !me?.token) continue;

        try {
          const result = await resolveCanUseAllUserCommunication();
          if (!cancelled) {
            setShowAllUserCommunication(Boolean(result.allowed));
          }
          if (result?.allowed) return;
        } catch {
          // retry
        }
      }
    };

    resolveAuc();
    return () => {
      cancelled = true;
    };
  }, [sessionUserId, authUser, location.pathname]);

  // Load permission-driven menu once session user is available; retry briefly after login.
  useEffect(() => {
    let cancelled = false;

    const loadMenu = async () => {
      const attempts = [0, 300, 800];
      for (const delay of attempts) {
        if (cancelled) return;
        if (delay) await sleep(delay);

        const me = getSessionUserIdentity();
        if (!me?.userId && !me?.token) continue;

        try {
          const menu = await getChatPermissionMenu();
          if (!cancelled) {
            setPermissionMenu(Array.isArray(menu) ? menu : []);
            return;
          }
        } catch {
          if (!cancelled) setPermissionMenu(null);
        }
      }
    };

    loadMenu();
    return () => {
      cancelled = true;
    };
  }, [sessionUserId, authUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getChatUnreadCountsByPeer();
        if (!cancelled && result && typeof result.totalUnread === "number") {
          setMessagesUnreadTotal(result.totalUnread);
        }
      } catch {
        // ignore
      }
      try {
        const rows = await getChatGroups();
        if (!cancelled) {
          const mapped = (rows || []).map((g) => ({
            unread: Math.max(
              0,
              Number(g.unreadCount ?? g.UnreadCount ?? g.unread ?? 0) || 0
            ),
          }));
          setGroupsUnreadTotal(sumGroupListUnread(mapped));
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  useEffect(() => {
    const me = getSessionUserIdentity();
    const myId = me?.userId != null ? String(me.userId) : "";
    if (!myId) return undefined;

    return subscribeChatPresence((event, payload) => {
      if (event !== "ReceiveMessage" || !payload) return;
      const path = String(window.location?.pathname || "");

      const groupId = payload.groupId ?? payload.GroupId;
      const senderId = String(
        payload.senderUserId ?? payload.SenderUserId ?? ""
      );
      const messageId = payload.messageId ?? payload.MessageId;
      const chatId = Number(payload.chatId ?? payload.ChatId ?? 0);

      if (groupId != null && groupId !== "") {
        if (
          senderId &&
          senderId !== myId &&
          Number.isFinite(chatId) &&
          chatId > 0
        ) {
          ackChatMessageDelivered(messageId, senderId, chatId);
        }
        if (path.includes("/communication/groups")) return;
        if (senderId === myId) return;
        setGroupsUnreadTotal(getGroupsUnreadTotal() + 1);
        return;
      }

      if (path.includes("/communication/messages")) return;

      const receiverId = String(
        payload.receiverUserId ?? payload.ReceiverUserId ?? ""
      );
      if (receiverId !== myId || senderId === myId) return;

      setMessagesUnreadTotal(getMessagesUnreadTotal() + 1);
    });
  }, [sessionUserId]);

  return buildCommunicationMenu({
    messagesUnread,
    groupsUnread,
    showAllUserCommunication,
    permissionMenu,
    isMasterOpen,
    onToggleMaster,
    // SoftOnCloud PRIME / ADMIN / *_ADMIN — not hardcoded "Employee"
    showMaster: isProductAdminSession(),
  });
};

/** @deprecated Prefer useNavData() so the Messages badge stays reactive. */
const Navdata = () =>
  buildCommunicationMenu({
    messagesUnread: getMessagesUnreadTotal(),
    groupsUnread: getGroupsUnreadTotal(),
    showAllUserCommunication: shouldShowAllUserCommunicationMenu(),
    permissionMenu: null,
    showMaster: isProductAdminSession(),
  });

export default Navdata;
