/**
 * SoftOnCloud product-admin APIs for Master screens
 * (Manage Users / Roles / Permissions).
 * New helpers only — does not modify existing auth/chat helpers.
 */
import { APIClient } from "./api_helper";
import * as url from "./url_helper";
import {
  getAuthSession,
  getConfiguredProductId,
  getOrganisationProductUsers,
  getSessionPublicOrgId,
  getSessionUserIdentity,
} from "./softoncloud_auth_helper";

const api = new APIClient();

const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.roles)) return payload.roles;
  if (Array.isArray(payload?.users)) return payload.users;
  return [];
};

/** Numeric org id for SoftOnCloud JSON bodies (org_id). */
export const getSessionNumericOrgId = () => {
  const session = getAuthSession();
  const candidates = [
    session?.loginOrgId,
    session?.orgId,
    session?.organizationId,
    session?.user?.orgId,
    session?.productContext?.orgId,
    session?.organisation?.orgId,
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
};

/** Product code prefix for role_code (e.g. CHATS_MANAGER). */
export const getSessionProductCode = () => {
  const session = getAuthSession();
  const raw =
    session?.product?.productCode ||
    session?.productContext?.productCode ||
    session?.productConnection?.productCode ||
    process.env.REACT_APP_PRODUCT_CODE ||
    "CHATS";
  return String(raw || "CHATS")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") || "CHATS";
};

/** True when resolve-context / session shows an *_ADMIN role for this app. */
export const isProductAdminSession = () => {
  const me = getSessionUserIdentity();
  const codes = me?.roleCodes || [];
  const names = me?.roleNames || [];
  const userType = String(me?.userType || "").toUpperCase();
  if (userType === "PRIME" || userType === "ADMIN") return true;
  if (codes.some((c) => String(c || "").toUpperCase().endsWith("_ADMIN"))) {
    return true;
  }
  if (names.some((n) => /admin/i.test(String(n || "")))) return true;
  return false;
};

export const getMasterScope = () => {
  const publicOrgId = getSessionPublicOrgId();
  const productId = getConfiguredProductId();
  const orgId = getSessionNumericOrgId();
  return { publicOrgId, productId, orgId };
};

const orgProductBase = (publicOrgId, productId) =>
  `${url.GET_ORGANISATION_PRODUCT_USERS}/${publicOrgId}/products/${productId}`;

/**
 * Directory list — SoftOnCloud product users
 * GET /api/organisations/{publicOrgId}/products/{productId}/users
 */
export const listProductUsers = async () => {
  const { publicOrgId, productId } = getMasterScope();
  if (!publicOrgId || !productId) {
    throw new Error("Organisation or product is not available in session.");
  }
  const response = await getOrganisationProductUsers(publicOrgId, productId);
  return asArray(response);
};

/**
 * Management list (includes isRestricted)
 * GET .../products/{app-id}/sub-users
 */
export const listProductSubUsers = async () => {
  const { publicOrgId, productId } = getMasterScope();
  if (!publicOrgId || !productId) {
    throw new Error("Organisation or product is not available in session.");
  }
  const response = await api.get(
    `${orgProductBase(publicOrgId, productId)}/sub-users`
  );
  return asArray(response);
};

/** POST /api/auth/sub-users */
export const createProductSubUser = (payload) => {
  const { orgId, productId } = getMasterScope();
  return api.create(url.POST_AUTH_SUB_USERS, {
    ...payload,
    org_id: payload.org_id ?? orgId,
    product_id: payload.product_id ?? productId,
  });
};

/** PUT .../sub-users/{publicUserId} */
export const updateProductSubUser = (publicUserId, payload) => {
  const { publicOrgId, productId } = getMasterScope();
  return api.put(
    `${orgProductBase(publicOrgId, productId)}/sub-users/${publicUserId}`,
    payload
  );
};

/** DELETE .../sub-users/{publicUserId} */
export const deleteProductSubUser = (publicUserId) => {
  const { publicOrgId, productId } = getMasterScope();
  return api.delete(
    `${orgProductBase(publicOrgId, productId)}/sub-users/${publicUserId}`
  );
};

/** POST .../sub-users/{publicUserId}/restrict */
export const restrictProductSubUser = (publicUserId) => {
  const { publicOrgId, productId } = getMasterScope();
  return api.create(
    `${orgProductBase(publicOrgId, productId)}/sub-users/${publicUserId}/restrict`
  );
};

/** POST .../sub-users/{publicUserId}/unrestrict */
export const unrestrictProductSubUser = (publicUserId) => {
  const { publicOrgId, productId } = getMasterScope();
  return api.create(
    `${orgProductBase(publicOrgId, productId)}/sub-users/${publicUserId}/unrestrict`
  );
};

/** POST .../members/{publicUserId}/product-roles */
export const assignProductRole = (publicUserId, roleId) => {
  const { publicOrgId, productId } = getMasterScope();
  return api.create(
    `${url.GET_ORGANISATION_PRODUCT_USERS}/${publicOrgId}/members/${publicUserId}/product-roles`,
    { product_id: productId, role_id: roleId }
  );
};

/**
 * GET /api/organisations/{publicOrgId}/roles?productId={app-id}
 * Pass includeInactive=true for role management screen.
 */
export const listProductRoles = async (includeInactive = false) => {
  const { publicOrgId, productId } = getMasterScope();
  if (!publicOrgId || !productId) {
    throw new Error("Organisation or product is not available in session.");
  }
  const params = { productId };
  if (includeInactive) params.includeInactive = true;
  const response = await api.get(
    `${url.GET_ORGANISATION_PRODUCT_USERS}/${publicOrgId}/roles`,
    params
  );
  return asArray(response);
};

/** POST /api/organisations/roles */
export const createProductRole = ({ roleCode, roleName, description }) => {
  const { orgId, productId } = getMasterScope();
  return api.create(url.POST_ORGANISATION_ROLES, {
    action: "create",
    org_id: orgId || 0,
    product_id: productId,
    role_code: roleCode,
    role_name: roleName,
    description: description || null,
  });
};

/** PUT /api/organisations/roles/{roleId} — action=update|activate|deactivate|delete */
export const manageProductRole = (roleId, body) => {
  const { orgId, productId } = getMasterScope();
  return api.put(`${url.POST_ORGANISATION_ROLES}/${roleId}`, {
    org_id: orgId || 0,
    product_id: productId,
    ...body,
  });
};

/** Chat menu tabs for Manage Permissions matrix (UI-only; SoftOnCloud has no tab-ACL API). */
export const CHAT_PERMISSION_TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "messages", label: "Messages" },
  { id: "groups", label: "Groups" },
  { id: "announcements", label: "Announcements" },
  { id: "settings", label: "Settings" },
  { id: "all-user-communication", label: "All User Communication" },
  { id: "master", label: "Master" },
  { id: "manage-users", label: "Manage Users" },
  { id: "manage-roles", label: "Manage Roles" },
  { id: "manage-permissions", label: "Manage Permissions" },
  { id: "logout", label: "Logout" },
];

const permissionStorageKey = (roleId) => {
  const { publicOrgId, productId } = getMasterScope();
  return `chat_role_permissions_${publicOrgId || "org"}_${productId || "app"}_${roleId}`;
};

const defaultPermissionsForRole = () =>
  CHAT_PERMISSION_TABS.map((tab) => ({
    tabId: tab.id,
    tab: tab.label,
    view: true,
    add: true,
    edit: true,
    delete: true,
    active: true,
  }));

export const loadRolePermissions = (roleId) => {
  if (roleId == null || roleId === "") return defaultPermissionsForRole();
  try {
    const raw = localStorage.getItem(permissionStorageKey(roleId));
    if (!raw) return defaultPermissionsForRole();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return defaultPermissionsForRole();
    return CHAT_PERMISSION_TABS.map((tab) => {
      const row = parsed.find((p) => p.tabId === tab.id || p.tab === tab.label);
      return {
        tabId: tab.id,
        tab: tab.label,
        view: Boolean(row?.view),
        add: Boolean(row?.add),
        edit: Boolean(row?.edit),
        delete: Boolean(row?.delete),
        active: Boolean(row?.active),
      };
    });
  } catch {
    return defaultPermissionsForRole();
  }
};

export const saveRolePermissions = (roleId, rows) => {
  if (roleId == null || roleId === "") return;
  localStorage.setItem(permissionStorageKey(roleId), JSON.stringify(rows));
};

export const resetRolePermissions = (roleId) => {
  if (roleId == null || roleId === "") return defaultPermissionsForRole();
  try {
    localStorage.removeItem(permissionStorageKey(roleId));
  } catch {
    /* ignore */
  }
  return defaultPermissionsForRole();
};
