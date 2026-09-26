/**
 * One-to-One Messages — menu + reaction features (WhatsApp-style UI).
 * Used by Messages/index.js for:
 * - Message bubble menu: Reply, Copy, Download, Forward, Star, More, Delete + reactions
 * - Chat header ⋮ menu: Contact info, Search, Select, Mute, Export, Close, Clear, Delete
 * - Reaction details modal (DP + name) shared with Groups
 */
import React, { useEffect, useMemo, useState } from "react";
import { Modal, ModalBody, Spinner } from "reactstrap";
import classnames from "classnames";
import SimpleBar from "simplebar-react";
import {
  getChatMessageReactions,
  resolveUserAvatarUrl,
} from "../../../helpers/softoncloud_auth_helper";
import { getCommAvatarSrc } from "../components/CommAvatar";
import userDummyImage from "../../../assets/images/users/user-dummy-img.jpg";

export const messageActionItems = [
  { id: "reply", label: "Reply", icon: "ri-reply-line" },
  { id: "copy", label: "Copy", icon: "ri-file-copy-line" },
  { id: "download", label: "Download", icon: "ri-download-2-line" },
  { id: "forward", label: "Forward", icon: "ri-share-forward-line" },
  { id: "star", label: "Star", icon: "ri-star-line" },
  { id: "more", label: "More", icon: "ri-more-fill" },
  { id: "divider-delete", type: "divider" },
  { id: "delete", label: "Delete", icon: "ri-delete-bin-line", danger: true },
];

/** WhatsApp-style quick reactions — UI shows emoji, API sends reactionCode */
export const QUICK_REACTIONS = [
  { code: "LIKE", emoji: "👍" },
  { code: "LOVE", emoji: "❤️" },
  { code: "LAUGH", emoji: "😂" },
  { code: "WOW", emoji: "😮" },
  { code: "SAD", emoji: "😢" },
  { code: "THANKS", emoji: "🙏" },
];

const REACTION_CODE_SET = new Set(QUICK_REACTIONS.map((r) => r.code));

export const reactionCodeToEmoji = (code) => {
  if (!code) return null;
  const found = QUICK_REACTIONS.find(
    (r) => r.code === String(code).trim().toUpperCase()
  );
  return found?.emoji || null;
};

/** Normalize emoji variants (e.g. ❤ vs ❤️) before mapping to code */
export const normalizeEmojiKey = (emoji) =>
  String(emoji || "")
    .replace(/\uFE0F/g, "")
    .trim();

export const emojiToReactionCode = (emoji) => {
  if (!emoji) return null;
  const key = normalizeEmojiKey(emoji);
  const found = QUICK_REACTIONS.find(
    (r) => normalizeEmojiKey(r.emoji) === key
  );
  return found?.code || null;
};

export const normalizeReactionCode = (value) => {
  if (value == null || String(value).trim() === "") return null;
  const asCode = String(value).trim().toUpperCase();
  if (REACTION_CODE_SET.has(asCode)) return asCode;
  return emojiToReactionCode(value);
};

/** Join my + peer reaction emojis for the WhatsApp-style badge (unique order). */
export const joinReactionEmojis = (...emojis) => {
  const seen = new Set();
  const parts = [];
  emojis.forEach((emoji) => {
    const value = String(emoji || "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    parts.push(value);
  });
  return parts.length ? parts.join("") : null;
};

export const patchMessageReactions = (msg, patch = {}) => {
  const reactionCode =
    patch.reactionCode !== undefined ? patch.reactionCode : msg.reactionCode;
  const peerReactionCode =
    patch.peerReactionCode !== undefined
      ? patch.peerReactionCode
      : msg.peerReactionCode;
  const myEmoji =
    patch.myEmoji !== undefined
      ? patch.myEmoji
      : reactionCode
        ? reactionCodeToEmoji(reactionCode)
        : null;
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

const REACTION_STORAGE_KEY = "chat_message_reactions_v1";

export const readStoredReactions = () => {
  try {
    const raw = localStorage.getItem(REACTION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const writeStoredReactions = (map) => {
  try {
    localStorage.setItem(REACTION_STORAGE_KEY, JSON.stringify(map || {}));
  } catch {
    // ignore quota / private mode
  }
};

/** Chat header ⋮ menu — Contact info, Search, Select, Mute, Export, Close, Clear, Delete */
export const moreMenuItems = [
  { id: "contact-info", label: "Contact info", icon: "ri-information-line" },
  // Starred Messages menu option hidden — Personal Star in contact panel stays
  { id: "search", label: "Search", icon: "ri-search-line" },
  { id: "select", label: "Select messages", icon: "ri-checkbox-line" },
  {
    id: "mute",
    label: "Mute notifications",
    icon: "ri-notification-off-line",
    hasSub: true,
  },
  { id: "export", label: "Export chat", icon: "ri-download-2-line" },
  { id: "close-chat", label: "Close chat", icon: "ri-close-circle-line" },
  { id: "divider-danger", type: "divider" },
  {
    id: "clear",
    label: "Clear chat",
    icon: "ri-indeterminate-circle-line",
    danger: true,
  },
  { id: "delete", label: "Delete chat", icon: "ri-delete-bin-line", danger: true },
];

const CODE_TO_EMOJI = {
  LIKE: "👍",
  LOVE: "❤️",
  LAUGH: "😂",
  WOW: "😮",
  SAD: "😢",
  THANKS: "🙏",
};

const emojiFor = (code, emoji) =>
  emoji || CODE_TO_EMOJI[String(code || "").toUpperCase()] || "👍";

const seedFromMessage = (msg, meUserId, peerUserId) => {
  if (!msg) return [];
  const rows = [];
  const myCode = msg.reactionCode || null;
  const myEmoji = msg.myEmoji || emojiFor(myCode, null);
  if (myCode && meUserId) {
    rows.push({
      userId: meUserId,
      reactionCode: String(myCode).toUpperCase(),
      reactionEmoji: myEmoji,
      reactedOn: null,
    });
  }
  const peerCode = msg.peerReactionCode || null;
  const peerEmoji = msg.peerReaction || emojiFor(peerCode, null);
  if (peerCode && peerUserId && String(peerUserId) !== String(meUserId)) {
    rows.push({
      userId: peerUserId,
      reactionCode: String(peerCode).toUpperCase(),
      reactionEmoji: peerEmoji,
      reactedOn: null,
    });
  }
  if (!rows.length && msg.reaction && String(msg.reaction).trim() !== "") {
    const who =
      msg.from === "me" && peerUserId
        ? peerUserId
        : meUserId || peerUserId;
    if (who) {
      rows.push({
        userId: who,
        reactionCode: "LIKE",
        reactionEmoji: String(msg.reaction).trim().slice(0, 4) || "👍",
        reactedOn: null,
      });
    }
  }
  return rows;
};

/**
 * WhatsApp-style reaction details modal (DP + name).
 * Shared by Messages + Groups — kept in this existing file (no new file).
 */
export const MessageReactionDetails = ({
  isOpen,
  messageId,
  message = null,
  meUserId = null,
  peerUserId = null,
  resolveUser = null,
  onClose,
  onRemoveMine = null,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reactions, setReactions] = useState([]);
  const [tab, setTab] = useState("ALL");

  useEffect(() => {
    if (!isOpen || !messageId) {
      setReactions([]);
      setError("");
      setTab("ALL");
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const seed = seedFromMessage(message, meUserId, peerUserId);
      try {
        const result = await getChatMessageReactions(messageId);
        if (cancelled) return;
        const raw =
          result?.reactions ??
          result?.Reactions ??
          result?.data?.reactions ??
          result?.data?.Reactions ??
          [];
        const rows = (Array.isArray(raw) ? raw : []).map((r) => ({
          userId: r.userId ?? r.UserId,
          reactionCode: String(
            r.reactionCode ?? r.ReactionCode ?? ""
          ).toUpperCase(),
          reactionEmoji: emojiFor(
            r.reactionCode ?? r.ReactionCode,
            r.reactionEmoji ??
              r.ReactionEmoji ??
              r.reaction ??
              r.Reaction
          ),
          reactedOn: r.reactedOn ?? r.ReactedOn ?? null,
        }));
        setReactions(rows.length ? rows : seed);
      } catch (err) {
        if (!cancelled) {
          setReactions(seed);
          if (!seed.length) {
            setError(
              err?.message ||
                err?.response?.data?.message ||
                "Unable to load reactions."
            );
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, messageId, message, meUserId, peerUserId]);

  useEffect(() => {
    if (!reactions.length) {
      setTab("ALL");
      return;
    }
    const first = reactions[0]?.reactionEmoji;
    if (first) setTab(first);
  }, [reactions]);

  const summary = useMemo(() => {
    const map = new Map();
    reactions.forEach((r) => {
      const key = r.reactionEmoji || r.reactionCode || "?";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()];
  }, [reactions]);

  const filtered = useMemo(() => {
    if (tab === "ALL") return reactions;
    return reactions.filter((r) => r.reactionEmoji === tab);
  }, [reactions, tab]);

  const resolveProfile = (userId) => {
    const isMe = String(userId) === String(meUserId ?? "");
    let u = null;
    if (typeof resolveUser === "function") {
      try {
        u = resolveUser(userId);
      } catch {
        u = null;
      }
    }
    const name = isMe
      ? "You"
      : u?.name || u?.email || u?.realName || `User ${userId}`;
    const rawAvatar =
      u?.avatarSrc || u?.img || u?.profileImage || u?.profileImageUrl || null;
    const avatarSrc =
      getCommAvatarSrc(userId, rawAvatar) ||
      resolveUserAvatarUrl(userId, rawAvatar) ||
      userDummyImage;
    return { isMe, name, avatarSrc };
  };

  const handleRowClick = (r, isMe) => {
    if (!isMe || typeof onRemoveMine !== "function") return;
    onRemoveMine(r.reactionCode || r.reactionEmoji);
  };

  return (
    <Modal
      isOpen={isOpen}
      toggle={onClose}
      centered
      size="sm"
      className="comm-wa-reaction-modal"
      contentClassName="comm-wa-reaction-sheet"
    >
      <ModalBody className="p-0">
        {loading ? (
          <div className="text-center py-4">
            <Spinner color="success" size="sm" />
          </div>
        ) : error ? (
          <p className="text-danger fs-13 mb-0 px-3 py-3">{error}</p>
        ) : !reactions.length ? (
          <p className="text-muted fs-13 mb-0 px-3 py-3">No reactions yet</p>
        ) : (
          <>
            <div className="comm-wa-reaction-pills">
              {summary.map(([emoji, count]) => (
                <button
                  key={emoji}
                  type="button"
                  className={classnames("comm-wa-reaction-pill", {
                    active: tab === emoji,
                  })}
                  onClick={() => setTab(emoji)}
                >
                  <span className="comm-wa-reaction-pill-emoji">{emoji}</span>
                  <span className="comm-wa-reaction-pill-count">{count}</span>
                </button>
              ))}
              {summary.length > 1 ? (
                <button
                  type="button"
                  className={classnames("comm-wa-reaction-pill", {
                    active: tab === "ALL",
                  })}
                  onClick={() => setTab("ALL")}
                >
                  All {reactions.length}
                </button>
              ) : null}
            </div>

            <div className="comm-wa-reaction-divider" />

            <SimpleBar className="comm-wa-reaction-scroll">
              <ul className="list-unstyled mb-0">
                {filtered.map((r) => {
                  const { isMe, name, avatarSrc } = resolveProfile(r.userId);
                  return (
                    <li key={`${r.userId}-${r.reactionCode}`}>
                      <button
                        type="button"
                        className={classnames("comm-wa-reaction-row", {
                          "is-mine": isMe && typeof onRemoveMine === "function",
                        })}
                        onClick={() => handleRowClick(r, isMe)}
                        disabled={!isMe || typeof onRemoveMine !== "function"}
                      >
                        <img
                          src={avatarSrc}
                          alt=""
                          className="comm-wa-reaction-dp"
                          onError={(e) => {
                            e.currentTarget.src = userDummyImage;
                          }}
                        />
                        <div className="comm-wa-reaction-meta">
                          <span className="comm-wa-reaction-name">{name}</span>
                          {isMe && typeof onRemoveMine === "function" ? (
                            <span className="comm-wa-reaction-hint">
                              Click to remove
                            </span>
                          ) : null}
                        </div>
                        <span className="comm-wa-reaction-emoji">
                          {r.reactionEmoji}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </SimpleBar>
          </>
        )}
      </ModalBody>
    </Modal>
  );
};

export default MessageReactionDetails;
