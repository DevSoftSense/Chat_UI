import { useEffect, useState } from "react";
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
} from "../helpers/softoncloud_auth_helper";

/**
 * Sidebar menu items with dynamic Messages + Groups unread badges.
 * Prefer this hook over calling the old Navdata() function.
 */
export const useNavData = () => {
  const [messagesUnread, setMessagesUnread] = useState(getMessagesUnreadTotal);
  const [groupsUnread, setGroupsUnread] = useState(getGroupsUnreadTotal);

  useEffect(() => subscribeMessagesUnreadTotal(setMessagesUnread), []);
  useEffect(() => subscribeGroupsUnreadTotal(setGroupsUnread), []);

  // Load totals on layout mount (works even before opening Messages/Groups).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getChatUnreadCountsByPeer();
        if (!cancelled && result && typeof result.totalUnread === "number") {
          setMessagesUnreadTotal(result.totalUnread);
        }
      } catch {
        // SQL / API may not be applied yet — keep current badge.
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
        // Groups API / unread subquery may fail — keep current badge.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live hub: delivery ack (Message Info) + sidebar unread badges.
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

      // Group: always ack delivery when this client receives the message (any page).
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
  }, []);

  return buildCommunicationMenu({ messagesUnread, groupsUnread });
};

/** @deprecated Prefer useNavData() so the Messages badge stays reactive. */
const Navdata = () =>
  buildCommunicationMenu({
    messagesUnread: getMessagesUnreadTotal(),
    groupsUnread: getGroupsUnreadTotal(),
  });

export default Navdata;
