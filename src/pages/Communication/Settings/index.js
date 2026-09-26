import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Input,
  Label,
  Row,
  Spinner,
} from "reactstrap";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import {
  getChatSettings,
  updateChatSettingsProfile,
  updateChatSettingsMessageDefaults,
  updateChatSettingsNotifications,
  resolveUserAvatarUrl,
  getSessionUserIdentity,
  updateSoftOnCloudProfile,
  updateSoftOnCloudProfileImage,
  mergeProfileIntoAuthSession,
  setChatDateFormat,
  syncChatRuntimePrefsFromSettings,
  setChatRuntimePrefs,
} from "../../../helpers/softoncloud_auth_helper";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "gu", label: "Gujarati" },
];
const DATE_FORMAT_OPTIONS = ["DD MMM YYYY", "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];

/** Settings → Notifications delivery options (theme-aware icons). */
const NOTIF_MODE_OPTIONS = [
  {
    value: "all",
    label: "Ball",
    icons: [{ icon: "ri-notification-3-fill", tone: "primary" }],
  },
  {
    value: "browser",
    label: "Browser",
    icons: [{ icon: "ri-global-line", tone: "info" }],
  },
  {
    value: "bell_browser",
    label: "Ball + Browser",
    icons: [
      { icon: "ri-notification-3-fill", tone: "primary" },
      { icon: "ri-global-line", tone: "info" },
    ],
  },
];

const normalizeNotifModeLocal = (value, fallback = "all") => {
  if (value === true || value === 1) return "all";
  if (value === false || value === 0) return "browser";
  const s = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s+]+/g, "_");
  if (s === "all" || s === "true") return "all";
  if (s === "browser" || s === "desktop") return "browser";
  if (
    s === "bell_browser" ||
    s === "bell" ||
    s === "notification_ball" ||
    s === "notification_ball_with_browser" ||
    s === "ball_browser"
  ) {
    return "bell_browser";
  }
  if (s === "none" || s === "false") return "browser";
  return fallback;
};

/** Bell / Browser icons — Velzon theme (primary/info + light/dark). */
const NotifModeIcons = ({ icons, className = "" }) => (
  <span className={`d-inline-flex align-items-center gap-1 ${className}`.trim()}>
    {(icons || []).map((item) => {
      const icon = typeof item === "string" ? item : item.icon;
      const tone = typeof item === "string" ? "primary" : item.tone || "primary";
      return (
        <span
          key={`${icon}-${tone}`}
          className={`avatar-title rounded-circle bg-${tone}-subtle text-${tone}`}
          style={{
            width: 22,
            height: 22,
            fontSize: 12,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <i className={icon}></i>
        </span>
      );
    })}
  </span>
);

const pick = (obj, camel, pascal, fallback) => {
  if (!obj) return fallback;
  if (obj[camel] !== undefined && obj[camel] !== null) return obj[camel];
  if (obj[pascal] !== undefined && obj[pascal] !== null) return obj[pascal];
  return fallback;
};

const apiErrorMessage = (err, fallback = "Something went wrong.") =>
  err?.response?.data?.message || err?.message || fallback;

const formatStorageLabel = (usedMB, limitMB) => {
  const used = Number(usedMB) || 0;
  const limit = Number(limitMB) || 0;
  const fmt = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`);
  return `${fmt(used)} / ${fmt(limit)}`;
};

const integrationOk = (status) => {
  const s = String(status || "").trim().toLowerCase();
  if (!s || s.includes("disconnect") || s.includes("disable") || s === "inactive") return false;
  return s.includes("enable") || s === "active" || s === "connected" || s === "ok";
};

const normalizeSettings = (raw) => {
  const data = raw || {};
  const profile = data.profile || data.Profile || {};
  const messageDefaults = data.messageDefaults || data.MessageDefaults || {};
  const notifications = data.notifications || data.Notifications || {};
  const status = data.status || data.Status || {};
  const privacy = data.privacy || data.Privacy || {};
  const storage = data.storage || data.Storage || {};
  const integrations = data.integrations || data.Integrations || [];
  const messageTypes = (messageDefaults.messageTypes || messageDefaults.MessageTypes || []).map((t) => ({
    messageTypeId: Number(pick(t, "messageTypeId", "MessageTypeId", 0)),
    typeName: String(pick(t, "typeName", "TypeName", "")),
  }));

  return {
    profile: {
      userId: Number(pick(profile, "userId", "UserId", 0)),
      fullName: String(pick(profile, "fullName", "FullName", "")),
      phone: String(pick(profile, "phone", "Phone", "")),
      photoUrl: pick(profile, "photoUrl", "PhotoUrl", null),
      role: String(pick(profile, "role", "Role", "")),
      department: String(pick(profile, "department", "Department", "")),
      timezone: String(pick(profile, "timezone", "Timezone", "UTC")),
      language: String(pick(profile, "language", "Language", "en")),
      dateFormat: String(pick(profile, "dateFormat", "DateFormat", "DD MMM YYYY")),
    },
    messageDefaults: {
      messageTypes,
      defaultMessageTypeId: Number(
        pick(messageDefaults, "defaultMessageTypeId", "DefaultMessageTypeId", 0)
      ),
      requestReadReceipt: Boolean(
        pick(messageDefaults, "requestReadReceipt", "RequestReadReceipt", true)
      ),
      autoSaveDraft: Boolean(pick(messageDefaults, "autoSaveDraft", "AutoSaveDraft", false)),
    },
    notifications: {
      messageReceived: normalizeNotifModeLocal(
        pick(notifications, "messageReceived", "MessageReceived", "all"),
        "all"
      ),
      groupMessages: normalizeNotifModeLocal(
        pick(notifications, "groupMessages", "GroupMessages", "all"),
        "all"
      ),
      announcements: normalizeNotifModeLocal(
        pick(notifications, "announcements", "Announcements", "all"),
        "all"
      ),
      soundEnabled: Boolean(pick(notifications, "soundEnabled", "SoundEnabled", true)),
      desktopEnabled: Boolean(pick(notifications, "desktopEnabled", "DesktopEnabled", true)),
      emailEnabled: Boolean(pick(notifications, "emailEnabled", "EmailEnabled", false)),
      mobilePushEnabled: Boolean(
        pick(notifications, "mobilePushEnabled", "MobilePushEnabled", true)
      ),
    },
    status: {
      status: String(pick(status, "status", "Status", "Online")),
      statusMessage: String(pick(status, "statusMessage", "StatusMessage", "")),
    },
    privacy: {
      whoCanMessage: String(pick(privacy, "whoCanMessage", "WhoCanMessage", "Everyone")),
      showLastSeen: String(pick(privacy, "showLastSeen", "ShowLastSeen", "ContactsOnly")),
      blockListAvailable: Boolean(pick(privacy, "blockListAvailable", "BlockListAvailable", false)),
    },
    storage: {
      usedMB: Number(pick(storage, "usedMB", "UsedMB", 0)),
      limitMB: Number(pick(storage, "limitMB", "LimitMB", 0)),
      percentage: Number(pick(storage, "percentage", "Percentage", 0)),
    },
    integrations: (Array.isArray(integrations) ? integrations : []).map((i) => ({
      providerId: Number(pick(i, "providerId", "ProviderId", 0)),
      name: String(pick(i, "name", "Name", "")),
      category: String(pick(i, "category", "Category", "")),
      status: String(pick(i, "status", "Status", "Disconnected")),
    })),
  };
};

const emptySettings = () => normalizeSettings({});

/** Browser IANA timezone, e.g. Asia/Kolkata */
const getBrowserTimeZone = () => {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC"
    );
  } catch {
    return "UTC";
  }
};

/** Current local time string for the given timezone */
const formatNowInTimeZone = (timeZone) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timeZone || getBrowserTimeZone(),
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(new Date());
  } catch {
    return new Date().toLocaleString();
  }
};

/** Prefer API timezone; if blank/UTC, use device timezone. */
const resolveDisplayTimeZone = (apiTimezone) => {
  const raw = String(apiTimezone || "").trim();
  if (!raw || raw.toUpperCase() === "UTC") return getBrowserTimeZone();
  return raw;
};

/** Fill blank API profile fields from logged-in session (display only until Update Profile). */
const mergeSessionIntoProfile = (normalized) => {
  const me = getSessionUserIdentity() || {};
  const profile = { ...normalized.profile };
  if (!profile.userId && me.userId) profile.userId = Number(me.userId) || 0;
  if (!profile.fullName && me.displayName) profile.fullName = String(me.displayName);
  if (!profile.phone && me.phone) profile.phone = String(me.phone);
  if (!profile.role && (me.role || me.jobTitle)) {
    profile.role = String(me.jobTitle || me.role || "");
  }
  if (!profile.department && me.department) profile.department = String(me.department);
  if (!profile.photoUrl && me.profileImage) profile.photoUrl = me.profileImage;
  profile.timezone = resolveDisplayTimeZone(profile.timezone);
  return { ...normalized, profile };
};

const Settings = () => {
  document.title = "Settings | Chat Module | SoftOnCloud";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [settings, setSettings] = useState(emptySettings);

  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phone: "",
    language: "en",
    dateFormat: "DD MMM YYYY",
  });
  const [msgForm, setMsgForm] = useState({
    defaultMessageTypeId: 0,
    requestReadReceipt: true,
    autoSaveDraft: false,
  });
  const [notifForm, setNotifForm] = useState({});
  const [notifModeOpenKey, setNotifModeOpenKey] = useState(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [clockNow, setClockNow] = useState(() =>
    formatNowInTimeZone(getBrowserTimeZone())
  );
  const avatarFileRef = useRef(null);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setToast(""), 2500);
  }, []);

  const applySettings = useCallback((normalized) => {
    // Merge saved All/Browser/Bell modes before wiping with API booleans.
    const prefs = syncChatRuntimePrefsFromSettings(normalized);
    const withModes = {
      ...normalized,
      notifications: {
        ...normalized.notifications,
        messageReceived: normalizeNotifModeLocal(
          prefs.messageReceived,
          "all"
        ),
        groupMessages: normalizeNotifModeLocal(prefs.groupMessages, "all"),
        announcements: normalizeNotifModeLocal(prefs.announcements, "all"),
      },
    };
    setSettings(withModes);
    setProfileForm({
      fullName: withModes.profile.fullName,
      phone: withModes.profile.phone,
      language: withModes.profile.language,
      dateFormat: withModes.profile.dateFormat,
    });
    if (withModes.profile.dateFormat) {
      setChatDateFormat(withModes.profile.dateFormat);
    }
    setMsgForm({
      defaultMessageTypeId: withModes.messageDefaults.defaultMessageTypeId,
      requestReadReceipt: withModes.messageDefaults.requestReadReceipt,
      autoSaveDraft: withModes.messageDefaults.autoSaveDraft,
    });
    setNotifForm({ ...withModes.notifications });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const raw = await getChatSettings();
      applySettings(mergeSessionIntoProfile(normalizeSettings(raw)));
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load settings."));
      applySettings(mergeSessionIntoProfile(emptySettings()));
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    load();
  }, [load]);

  // Live current time for the profile timezone.
  useEffect(() => {
    const tz = resolveDisplayTimeZone(settings.profile.timezone);
    setClockNow(formatNowInTimeZone(tz));
    const timer = window.setInterval(() => {
      setClockNow(formatNowInTimeZone(tz));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [settings.profile.timezone]);

  const runSave = async (fn, successMsg) => {
    setSaving(true);
    setError("");
    try {
      await fn();
      showToast(successMsg);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save settings."));
    } finally {
      setSaving(false);
    }
  };

  const avatarUrl = useMemo(
    () => resolveUserAvatarUrl(settings.profile.userId, settings.profile.photoUrl),
    [settings.profile.userId, settings.profile.photoUrl]
  );
  const displayTimeZone = useMemo(
    () => resolveDisplayTimeZone(settings.profile.timezone),
    [settings.profile.timezone]
  );
  const initials = (profileForm.fullName || "?").trim().charAt(0).toUpperCase();
  const pct = Math.min(100, Math.max(0, Number(settings.storage.percentage) || 0));

  const handleAvatarPick = async (event) => {
    const file = event?.target?.files?.[0];
    if (event?.target) event.target.value = "";
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setAvatarSaving(true);
    setError("");
    try {
      const saved = await updateSoftOnCloudProfileImage(file);
      const photoUrl = saved?.profileImageUrl || null;
      if (!photoUrl) throw new Error("Upload succeeded but no image URL returned.");

      setSettings((prev) => ({
        ...prev,
        profile: { ...prev.profile, photoUrl },
      }));

      // Keep chat settings photo in sync with SoftOnCloud profile image.
      try {
        await updateChatSettingsProfile({
          fullName: String(profileForm.fullName || "").trim() || "User",
          phone: String(profileForm.phone || "").trim() || null,
          photoUrl,
          language: String(profileForm.language || "en").trim(),
          dateFormat: String(profileForm.dateFormat || "DD MMM YYYY").trim(),
        });
      } catch {
        // SoftOnCloud image already saved — chat settings photo is best-effort.
      }

      window.dispatchEvent(
        new CustomEvent("chat-profile-updated", {
          detail: {
            profile: {
              profileImageUrl: photoUrl,
              displayName: profileForm.fullName,
            },
          },
        })
      );
      showToast("Profile photo updated");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update profile photo."));
    } finally {
      setAvatarSaving(false);
    }
  };

  const profileCard = (
    <>
      <div className="d-flex align-items-center gap-3 mb-3">
        <div className="position-relative flex-shrink-0" style={{ width: 56, height: 56 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <span
              className="d-inline-flex align-items-center justify-content-center bg-primary-subtle text-primary fw-semibold"
              style={{ width: 56, height: 56, borderRadius: "50%" }}
            >
              {initials}
            </span>
          )}
          <button
            type="button"
            className="btn btn-sm btn-light border rounded-circle p-0 d-inline-flex align-items-center justify-content-center"
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 28,
              height: 28,
            }}
            title="Edit profile photo"
            disabled={avatarSaving || saving}
            onClick={() => avatarFileRef.current?.click()}
          >
            {avatarSaving ? (
              <Spinner size="sm" />
            ) : (
              <i className="ri-camera-fill"></i>
            )}
          </button>
          <Input
            type="file"
            accept="image/*"
            className="d-none"
            innerRef={avatarFileRef}
            onChange={handleAvatarPick}
          />
        </div>
        <div>
          <h6 className="mb-0">{profileForm.fullName || "—"}</h6>
          <p className="text-muted fs-12 mb-0">
            {[settings.profile.role, settings.profile.department].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      </div>
      <div className="mb-2">
        <Label className="fs-12">Full Name</Label>
        <Input
          bsSize="sm"
          value={profileForm.fullName}
          onChange={(e) => setProfileForm((p) => ({ ...p, fullName: e.target.value }))}
        />
      </div>
      <div className="mb-2">
        <Label className="fs-12">Phone</Label>
        <Input
          bsSize="sm"
          value={profileForm.phone}
          onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
        />
      </div>
      <div className="mb-2">
        <Label className="fs-12">Language</Label>
        <Input
          type="select"
          bsSize="sm"
          value={profileForm.language}
          onChange={(e) => setProfileForm((p) => ({ ...p, language: e.target.value }))}
        >
          {LANGUAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Input>
      </div>
      <div className="mb-2">
        <Label className="fs-12">Time Zone</Label>
        <Input type="text" bsSize="sm" value={displayTimeZone} readOnly />
        <small className="text-muted d-block mt-1">
          Current time: {clockNow}
        </small>
      </div>
      <div className="mb-2">
        <Label className="fs-12">Date Format</Label>
        <Input
          type="select"
          bsSize="sm"
          value={profileForm.dateFormat}
          onChange={(e) => setProfileForm((p) => ({ ...p, dateFormat: e.target.value }))}
        >
          {DATE_FORMAT_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Input>
      </div>
      <Button
        color="primary"
        size="sm"
        className="mt-2"
        disabled={saving || avatarSaving}
        onClick={() => {
          const fullName = String(profileForm.fullName || "").trim();
          const language = String(profileForm.language || "").trim();
          const dateFormat = String(profileForm.dateFormat || "").trim();
          if (!fullName) {
            setError("Full name is required.");
            return;
          }
          if (!language) {
            setError("Language is required.");
            return;
          }
          if (!dateFormat) {
            setError("Date format is required.");
            return;
          }

          // PUT /api/settings/profile?orgId&appId&fiscalYearId
          // Body matches Swagger: fullName, phone, photoUrl, language, dateFormat
          const payload = {
            fullName,
            phone: String(profileForm.phone || "").trim() || null,
            photoUrl: settings.profile.photoUrl || null,
            language,
            dateFormat,
          };

          runSave(async () => {
            // Keep timezone display on current device zone after save.
            setSettings((prev) => ({
              ...prev,
              profile: {
                ...prev.profile,
                timezone: displayTimeZone,
              },
            }));

            // 1) Chat settings API (employee + org_setting prefs)
            await updateChatSettingsProfile(payload);

            // 2) SoftOnCloud profile API — Personal Details panel (Messages) reads this
            let softProfile = null;
            try {
              softProfile = await updateSoftOnCloudProfile({
                displayName: fullName,
                name: fullName,
                phone: payload.phone,
              });
            } catch {
              // SoftOnCloud profile may fail; still keep chat settings + session patch
              softProfile = {
                displayName: fullName,
                phone: payload.phone,
                profileImageUrl: payload.photoUrl,
              };
              mergeProfileIntoAuthSession(softProfile);
            }

            window.dispatchEvent(
              new CustomEvent("chat-profile-updated", {
                detail: {
                  profile: {
                    displayName: softProfile?.displayName || fullName,
                    phone: softProfile?.phone || payload.phone,
                    email: softProfile?.email,
                    jobTitle: softProfile?.jobTitle,
                    department: softProfile?.department,
                    location: softProfile?.location,
                    profileImageUrl:
                      softProfile?.profileImageUrl || payload.photoUrl || null,
                    userId: softProfile?.userId,
                  },
                },
              })
            );

            // Apply date format preference immediately (Messages day chips, etc.)
            setChatDateFormat(dateFormat);

            const raw = await getChatSettings();
            applySettings(mergeSessionIntoProfile(normalizeSettings(raw)));
          }, "Profile updated");
        }}
      >
        Update Profile
      </Button>
    </>
  );

  const messageDefaultsCard = (
    <>
      <div className="mb-2">
        <Label className="fs-12">Default Message Type</Label>
        <Input
          type="select"
          bsSize="sm"
          value={msgForm.defaultMessageTypeId || ""}
          onChange={(e) =>
            setMsgForm((p) => ({ ...p, defaultMessageTypeId: Number(e.target.value) }))
          }
        >
          {(settings.messageDefaults.messageTypes || []).length === 0 && (
            <option value="">No types available</option>
          )}
          {(settings.messageDefaults.messageTypes || []).map((t) => (
            <option key={t.messageTypeId} value={t.messageTypeId}>
              {t.typeName}
            </option>
          ))}
        </Input>
      </div>
      <div className="form-check form-switch mb-2">
        <Input
          type="checkbox"
          role="switch"
          checked={msgForm.requestReadReceipt}
          onChange={(e) => setMsgForm((p) => ({ ...p, requestReadReceipt: e.target.checked }))}
        />
        <Label check className="fs-13">
          Request Read Receipt
        </Label>
      </div>
      <div className="form-check form-switch mb-2">
        <Input
          type="checkbox"
          role="switch"
          checked={msgForm.autoSaveDraft}
          onChange={(e) => setMsgForm((p) => ({ ...p, autoSaveDraft: e.target.checked }))}
        />
        <Label check className="fs-13">
          Auto Save Draft
        </Label>
      </div>
      <Button
        color="primary"
        size="sm"
        disabled={saving || !msgForm.defaultMessageTypeId}
        onClick={() =>
          runSave(async () => {
            const result = await updateChatSettingsMessageDefaults(msgForm);
            const nextDefaults = {
              ...settings.messageDefaults,
              ...normalizeSettings({ messageDefaults: result }).messageDefaults,
              messageTypes: settings.messageDefaults.messageTypes,
            };
            setSettings((prev) => ({
              ...prev,
              messageDefaults: nextDefaults,
            }));
              syncChatRuntimePrefsFromSettings({
                messageDefaults: nextDefaults,
                notifications: notifForm,
                status: settings.status,
              });
            }, "Message defaults saved")
          }
      >
        Save Defaults
      </Button>
    </>
  );

  const notificationsCard = () => {
    const rows = [
      { key: "messageReceived", label: "Message Received" },
      { key: "groupMessages", label: "Group Messages" },
      { key: "announcements", label: "Announcements" },
    ];
    return (
      <>
        {rows.map((n) => {
          const mode = normalizeNotifModeLocal(notifForm[n.key], "all");
          const selected =
            NOTIF_MODE_OPTIONS.find((o) => o.value === mode) || NOTIF_MODE_OPTIONS[0];
          return (
            <div
              key={n.key}
              className="d-flex justify-content-between align-items-center mb-2 gap-2"
            >
              <span className="fs-13">{n.label}</span>
              <Dropdown
                isOpen={notifModeOpenKey === n.key}
                toggle={() =>
                  setNotifModeOpenKey((prev) => (prev === n.key ? null : n.key))
                }
              >
                <DropdownToggle
                  caret
                  color="soft-primary"
                  size="sm"
                  className="d-inline-flex align-items-center gap-1"
                  style={{ minWidth: 158 }}
                  disabled={saving}
                >
                  <NotifModeIcons icons={selected.icons} />
                  <span className="fs-12 text-body">{selected.label}</span>
                </DropdownToggle>
                <DropdownMenu end style={{ minWidth: 210 }}>
                  {NOTIF_MODE_OPTIONS.map((o) => (
                    <DropdownItem
                      key={o.value}
                      active={o.value === mode}
                      className="d-flex align-items-center gap-2"
                      onClick={() => {
                        setNotifForm((p) => ({ ...p, [n.key]: o.value }));
                        setChatRuntimePrefs({ [n.key]: o.value });
                        setNotifModeOpenKey(null);
                      }}
                    >
                      <NotifModeIcons icons={o.icons} />
                      <span className="text-body">{o.label}</span>
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            </div>
          );
        })}
        <Button
          color="primary"
          outline
          size="sm"
          className="mt-2"
          disabled={saving}
          onClick={() =>
            runSave(async () => {
              const modes = {
                messageReceived: normalizeNotifModeLocal(notifForm.messageReceived, "all"),
                groupMessages: normalizeNotifModeLocal(notifForm.groupMessages, "all"),
                announcements: normalizeNotifModeLocal(notifForm.announcements, "all"),
              };
              // API still stores channel on/off; all 3 modes stay enabled server-side.
              const apiPayload = {
                ...notifForm,
                messageReceived: true,
                groupMessages: true,
                announcements: true,
                desktopEnabled: true,
              };
              const result = await updateChatSettingsNotifications(apiPayload);
              const nextNotif = {
                ...normalizeSettings({ notifications: result }).notifications,
                ...modes,
              };
              setSettings((prev) => ({
                ...prev,
                notifications: nextNotif,
              }));
              setNotifForm(nextNotif);
              syncChatRuntimePrefsFromSettings({
                messageDefaults: settings.messageDefaults,
                notifications: nextNotif,
                status: settings.status,
              });
              const needsBrowser = Object.values(modes).some(
                (m) => m === "all" || m === "browser" || m === "bell_browser"
              );
              if (
                needsBrowser &&
                typeof Notification !== "undefined" &&
                Notification.permission === "default"
              ) {
                try {
                  await Notification.requestPermission();
                } catch {
                  /* ignore */
                }
              }
            }, "Notifications saved")
          }
        >
          Save Notifications
        </Button>
      </>
    );
  };

  const storageCard = (
    <>
      <div className="mb-3">
        <div className="d-flex justify-content-between fs-12 mb-1">
          <span>Storage Used</span>
          <span>{formatStorageLabel(settings.storage.usedMB, settings.storage.limitMB)}</span>
        </div>
        <div className="progress progress-sm">
          <div className="progress-bar bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p className="text-muted fs-12 mb-0">
        Limit from ChatMaxFileSizeMB. Used size from your chat attachments.
      </p>
    </>
  );

  const integrationsCard = (
    <>
      {!settings.integrations.length ? (
        <p className="text-muted fs-13 mb-0">No integrations configured.</p>
      ) : (
        settings.integrations.map((int) => {
          const ok = integrationOk(int.status);
          return (
            <div
              key={int.providerId || int.name}
              className="d-flex justify-content-between py-2 border-bottom"
            >
              <div>
                <span className="fs-13 d-block">{int.name}</span>
                {int.category ? <span className="text-muted fs-11">{int.category}</span> : null}
              </div>
              <span
                className={`badge bg-${ok ? "success" : "danger"}-subtle text-${
                  ok ? "success" : "danger"
                }`}
              >
                {int.status || "Disconnected"}
              </span>
            </div>
          );
        })
      )}
    </>
  );

  const settingsCards = [
    ["Profile & Preferences", profileCard],
    ["Message Defaults", messageDefaultsCard],
    ["Notifications", notificationsCard()],
    ["Data & Storage", storageCard],
    ["Integrations", integrationsCard],
  ];

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Settings" pageTitle="Chat" />

        {error ? (
          <Alert color="danger" toggle={() => setError("")}>
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <div className="text-center py-5">
            <Spinner color="primary" />
            <p className="text-muted mt-2 mb-0">Loading settings…</p>
          </div>
        ) : (
          <Row className="g-3">
            {settingsCards.map(([title, body]) => (
              <Col xl={4} md={6} key={title}>
                <Card className="card-height-100">
                  <CardHeader>
                    <h4 className="card-title mb-0 fs-15">{title}</h4>
                  </CardHeader>
                  <CardBody>{body}</CardBody>
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {toast ? (
          <div
            className="alert alert-dark shadow"
            style={{
              position: "fixed",
              left: "50%",
              bottom: 24,
              transform: "translateX(-50%)",
              zIndex: 1090,
              minWidth: 220,
              textAlign: "center",
              margin: 0,
            }}
          >
            {toast}
          </div>
        ) : null}
      </Container>
    </div>
  );
};

export default Settings;
