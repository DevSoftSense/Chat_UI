/**
 * One-to-One Messages — menu + reaction features (WhatsApp-style UI).
 * Used by Messages/index.js for:
 * - Message bubble menu: Reply, Copy, Download, Forward, Star, More, Delete + reactions
 * - Chat header ⋮ menu: Contact info, Search, Select, Mute, Export, Close, Clear, Delete
 */

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
