/**
 * Thin Group Chat API surface — reuses SoftOnCloud/Chat helpers (no second Axios).
 */
export {
  getChatGroups as getGroups,
  getChatGroupDetails as getGroupDetails,
  createChatGroup as createGroup,
  updateChatGroup as updateGroup,
  addChatGroupMembers as addGroupMembers,
  removeChatGroupMember as removeGroupMember,
  leaveChatGroup as leaveGroup,
  joinChatGroupHub as joinGroupHub,
  leaveChatGroupHub as leaveGroupHub,
} from "./softoncloud_auth_helper";
