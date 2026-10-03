/**
 * One-to-One Messages — Document / Photos & Videos / Audio attach helpers.
 * Image send + paperclip menu (Messages folder).
 */

export const ATTACH_BODY_RE = /^\[(Document|Photo|Video|Audio)\]\s+(.+)$/i;

export const IMAGE_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
]);
export const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "avi", "mkv"]);
export const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "m4a", "aac"]);

export const fileExt = (name) =>
  String(name || "")
    .split(".")
    .pop()
    ?.toLowerCase() || "";

/** Paperclip menu — Document / Photos & Videos / Audio */
export const attachMenuItems = [
  {
    id: "document",
    label: "Document",
    icon: "ri-file-text-fill",
    color: "purple",
    accept:
      ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain",
  },
  {
    id: "media",
    label: "Photos & Videos",
    icon: "ri-image-fill",
    color: "blue",
    accept: "image/*,video/*",
  },
  {
    id: "audio",
    label: "Audio",
    icon: "ri-headphone-fill",
    color: "orange",
    accept: "audio/*",
  },
];

/** Parse [Photo] name / typeName into attachKind + caption for UI mapping. */
export const resolveAttachMeta = (messageBody, typeName) => {
  const body = String(messageBody || "").trim();
  const lines = body.split(/\r?\n/);
  const head = String(lines[0] || "").trim();
  const caption = lines.slice(1).join("\n").trim();
  const match = head.match(ATTACH_BODY_RE);
  if (match) {
    const label = match[1].toLowerCase();
    const fileName = match[2].trim();
    return {
      attachKind: label === "photo" || label === "video" ? "media" : label,
      fileName,
      text: caption || fileName,
      caption: caption || null,
      mediaSubtype:
        label === "video" ? "video" : label === "photo" ? "photo" : null,
    };
  }
  const name = String(typeName || "").toLowerCase();
  if (/image|photo|video|audio|document|file/.test(name)) {
    return {
      attachKind: /audio/.test(name)
        ? "audio"
        : /image|photo|video/.test(name)
          ? "media"
          : "document",
      fileName: head || body,
      text: caption || head || body,
      caption: caption || null,
      mediaSubtype: /video/.test(name)
        ? "video"
        : /image|photo/.test(name)
          ? "photo"
          : null,
    };
  }
  return null;
};

export const attachIconForMessage = (msg) => {
  if (msg?.mediaSubtype === "video") return "ri-video-fill";
  if (msg?.mediaSubtype === "photo" || msg?.attachKind === "media")
    return "ri-image-fill";
  if (msg?.attachKind === "audio") return "ri-headphone-fill";
  if (msg?.attachKind === "document") return "ri-file-text-fill";
  return "ri-attachment-2";
};

export const attachmentIconForFileName = (fileName) => {
  const ext = fileExt(fileName);
  if (!ext) return "ri-attachment-2";
  if (IMAGE_EXTS.has(ext)) return "ri-image-2-fill";
  if (VIDEO_EXTS.has(ext)) return "ri-video-fill";
  if (AUDIO_EXTS.has(ext)) return "ri-headphone-fill";
  if (["zip", "rar", "7z"].includes(ext)) return "ri-folder-zip-line";
  if (["ppt", "pptx"].includes(ext)) return "ri-file-ppt-2-line";
  if (["xls", "xlsx", "csv"].includes(ext)) return "ri-file-excel-2-line";
  if (["doc", "docx", "rtf", "odt"].includes(ext)) return "ri-file-word-2-line";
  if (ext === "pdf") return "ri-file-pdf-line";
  return "ri-file-text-fill";
};

/** Strip upload hash prefix from stored file names when present. */
export const cleanAttachmentDisplayName = (fileName) => {
  const raw = String(fileName || "attachment").trim() || "attachment";
  const underscore = raw.indexOf("_");
  if (underscore > 0 && underscore <= 32 && raw.length > underscore + 1) {
    const prefix = raw.slice(0, underscore);
    if (/^[a-f0-9]+$/i.test(prefix)) return raw.slice(underscore + 1);
  }
  return raw;
};

/** Body when sending with caption: [Photo] name.jpg\\ncaption */
export const formatAttachMessageBody = (kind, file, caption = "") => {
  const name = file?.name || "file";
  let head = `[Document] ${name}`;
  if (kind === "audio") head = `[Audio] ${name}`;
  else if (kind === "media") {
    const isVideo = String(file?.type || "").startsWith("video/");
    head = `[${isVideo ? "Video" : "Photo"}] ${name}`;
  }
  const cap = String(caption || "").trim();
  return cap ? `${head}\n${cap}` : head;
};

/** messageTypeId for attachment send in 1:1 flow. */
export const attachKindToMessageTypeId = (kind) => {
  if (kind === "media" || kind === "document" || kind === "audio") return 2;
  return 1;
};

/** First path from uploadChatAttachments response. */
export const pickUploadedAttachmentPath = (uploaded) =>
  uploaded?.attachmentPath1 ||
  uploaded?.data?.attachmentPath1 ||
  uploaded?.files?.[0]?.filePath ||
  uploaded?.data?.files?.[0]?.filePath ||
  uploaded?.paths?.[0] ||
  null;

/** Validate file MIME against paperclip menu kind. Returns error toast text or null. */
export const validateAttachFileKind = (kind, file) => {
  const type = String(file?.type || "");
  if (kind === "document") {
    if (
      type.startsWith("audio/") ||
      type.startsWith("image/") ||
      type.startsWith("video/")
    ) {
      return "Please choose a document file";
    }
  } else if (kind === "media") {
    if (!type.startsWith("image/") && !type.startsWith("video/")) {
      return "Please choose a photo or video";
    }
  } else if (kind === "audio") {
    if (!type.startsWith("audio/")) {
      return "Please choose an audio file";
    }
  }
  return null;
};

/* Composer drafts — typed text left without sending (Messages / Groups). */
const COMPOSER_DRAFTS_KEY = "softoncloud_chat_composer_drafts_v1";
export const COMPOSER_DRAFTS_EVENT = "chat-composer-drafts-changed";

const readComposerDraftMap = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(COMPOSER_DRAFTS_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
};

const writeComposerDraftMap = (map) => {
  localStorage.setItem(COMPOSER_DRAFTS_KEY, JSON.stringify(map || {}));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COMPOSER_DRAFTS_EVENT));
  }
};

export const dmDraftKey = (userId) =>
  userId != null && userId !== "" ? `dm:${userId}` : "";

export const groupDraftKey = (groupId) =>
  groupId != null && groupId !== "" ? `group:${groupId}` : "";

export const getComposerDraft = (key) => {
  if (!key) return "";
  return String(readComposerDraftMap()[key]?.text || "");
};

export const setComposerDraft = (key, text, meta = {}) => {
  if (!key) return;
  const map = readComposerDraftMap();
  const raw = String(text ?? "");
  const trimmed = raw.trim();
  if (!trimmed) {
    if (map[key]) {
      delete map[key];
      writeComposerDraftMap(map);
    }
    return;
  }
  map[key] = {
    text: raw,
    preview: trimmed.slice(0, 100),
    updatedAt: Date.now(),
    type: meta.type || (String(key).startsWith("group:") ? "group" : "dm"),
    name: meta.name || map[key]?.name || "",
    photo: meta.photo || map[key]?.photo || null,
    href: meta.href || map[key]?.href || "",
  };
  writeComposerDraftMap(map);
};

export const clearComposerDraft = (key) => {
  if (!key) return;
  const map = readComposerDraftMap();
  if (!map[key]) return;
  delete map[key];
  writeComposerDraftMap(map);
};

export const listComposerDrafts = () =>
  Object.entries(readComposerDraftMap())
    .map(([key, value]) => ({ key, ...(value || {}) }))
    .filter((d) => String(d.text || "").trim())
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

export const countComposerDrafts = () => listComposerDrafts().length;

/** WhatsApp-style draw colors (Send photo pencil). */
export const ATTACH_DRAW_COLORS = [
  "#8696a0",
  "#ffffff",
  "#53bdeb",
  "#00a884",
  "#ac85ff",
  "#ff7a59",
  "#ea4335",
];

/** Merge original image + draw strokes into a PNG File for upload. */
export const composeDrawnImageFile = (sourceFile, previewUrl, strokes, displaySize) =>
  new Promise((resolve, reject) => {
    if (!sourceFile || !previewUrl) {
      reject(new Error("Missing image."));
      return;
    }
    const list = Array.isArray(strokes) ? strokes : [];
    if (!list.length) {
      resolve(sourceFile);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const out = document.createElement("canvas");
        out.width = img.naturalWidth || img.width;
        out.height = img.naturalHeight || img.height;
        const ctx = out.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unavailable."));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dw = Math.max(1, Number(displaySize?.width) || out.width);
        const dh = Math.max(1, Number(displaySize?.height) || out.height);
        const sx = out.width / dw;
        const sy = out.height / dh;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        list.forEach((stroke) => {
          const pts = stroke?.points || [];
          if (pts.length < 2) return;
          ctx.strokeStyle = stroke.color || "#53bdeb";
          ctx.lineWidth = Math.max(1, (stroke.width || 4) * Math.max(sx, sy));
          ctx.beginPath();
          ctx.moveTo(pts[0].x * sx, pts[0].y * sy);
          for (let i = 1; i < pts.length; i += 1) {
            ctx.lineTo(pts[i].x * sx, pts[i].y * sy);
          }
          ctx.stroke();
        });
        out.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to export drawing."));
              return;
            }
            const base = String(sourceFile.name || "photo")
              .replace(/\.[^.]+$/, "")
              .trim() || "photo";
            resolve(
              new File([blob], `${base}-edit.png`, {
                type: "image/png",
                lastModified: Date.now(),
              })
            );
          },
          "image/png",
          0.95
        );
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for drawing."));
    img.src = previewUrl;
  });

