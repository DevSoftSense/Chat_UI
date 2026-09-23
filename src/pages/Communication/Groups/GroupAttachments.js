/**
 * Group chat — Photos & Videos / Document / Audio attach helpers.
 * Paperclip menu + classify uploaded files for group send.
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

/** Detect photo / video / audio / document from path or [Photo] body prefix. */
export const classifyAttachment = (path, body) => {
  const fileName =
    String(path || "")
      .split("/")
      .pop() || "";
  const head = String(body || "")
    .trim()
    .split(/\r?\n/)[0]
    .trim();
  const match = head.match(ATTACH_BODY_RE);
  if (match) {
    const label = match[1].toLowerCase();
    return {
      kind: label === "photo" || label === "video" ? "media" : label,
      mediaSubtype:
        label === "video" ? "video" : label === "photo" ? "photo" : null,
      fileName: match[2].trim() || fileName,
    };
  }
  const ext = fileExt(fileName);
  if (IMAGE_EXTS.has(ext)) {
    return { kind: "media", mediaSubtype: "photo", fileName };
  }
  if (VIDEO_EXTS.has(ext)) {
    return { kind: "media", mediaSubtype: "video", fileName };
  }
  if (AUDIO_EXTS.has(ext)) {
    return { kind: "audio", mediaSubtype: null, fileName };
  }
  return { kind: "document", mediaSubtype: null, fileName };
};

export const attachmentIconForFileName = (fileName) => {
  const ext = fileExt(fileName);
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

/** Paperclip menu — Document / Photos & Videos / Audio (image send uses media). */
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

/** messageTypeId: text=1, media=2, document=3, audio=4 */
export const attachKindToMessageTypeId = (kind) => {
  if (kind === "media") return 2;
  if (kind === "audio") return 4;
  return 3;
};

/** Body prefix when sending group image / file: [Photo] name.jpg */
export const formatGroupAttachMessageBody = (kind, fileName, caption = "") => {
  const name = String(fileName || "file").trim() || "file";
  let head = `[Document] ${name}`;
  if (kind === "audio") head = `[Audio] ${name}`;
  else if (kind === "media") {
    const isVideo = VIDEO_EXTS.has(fileExt(name));
    head = `[${isVideo ? "Video" : "Photo"}] ${name}`;
  }
  const cap = String(caption || "").trim();
  return cap ? `${head}\n${cap}` : head;
};

/** Pick first attachment path from uploadChatAttachments response. */
export const pickUploadedAttachmentPath = (uploaded) =>
  uploaded?.attachmentPath1 ||
  uploaded?.data?.attachmentPath1 ||
  uploaded?.files?.[0]?.filePath ||
  uploaded?.data?.files?.[0]?.filePath ||
  uploaded?.paths?.[0] ||
  null;
