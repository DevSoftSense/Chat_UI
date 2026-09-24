/**
 * Announcement API surface — reuses Chat axios helpers (no second client).
 */
export {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  markAnnouncementRead,
  pinAnnouncement,
  unpinAnnouncement,
  getAnnouncementCategories,
  getAnnouncementStats,
  getUnreadAnnouncementCount,
  getOrganisationProductUsers,
  getSessionPublicOrgId,
  getConfiguredProductId,
  getSessionUserIdentity,
  resolveUserAvatarUrl,
  subscribeChatPresence,
} from "../../../../helpers/softoncloud_auth_helper";
