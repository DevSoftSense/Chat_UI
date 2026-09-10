import { APIClient, setAuthorization } from "./api_helper";
import * as url from "./url_helper";
import { api as appConfig } from "../config";
import axios from "axios";

const api = new APIClient();

/**
 * SoftOnCloud Authentication API
 * POST /api/auth/login
 * Body: { orgId, email, password, rememberMe }
 */
export const postAuthLogin = (data) => {
  const orgIdRaw = data.orgId ?? data.organizationId;
  const orgIdParsed = parseInt(String(orgIdRaw ?? "").trim(), 10);
  const orgId = Number.isFinite(orgIdParsed) ? orgIdParsed : String(orgIdRaw ?? "").trim();

  return api.create(url.POST_AUTH_LOGIN, {
    orgId,
    email: data.email,
    password: data.password,
    rememberMe: Boolean(data.rememberMe),
  });
};

/**
 * SoftOnCloud Authorization API (ResolveUserContext)
 * GET /api/auth/resolve-context?productId={productId}
 * Auth: Bearer JWT
 */
export const resolveUserContext = (productId) =>
  api.get(url.GET_AUTH_RESOLVE_CONTEXT, { productId });

/**
 * SoftOnCloud Product Connection API
 * GET /api/auth/product-connection?productId={productId}
 * Auth: Bearer JWT (set after login via setAuthorization)
 * Query only — no request body.
 *
 * Success response includes:
 * productId, productCode, productName, dbGroup, resolvedConnectionString, fromCache
 */
export const getProductConnection = (productId) =>
  api.get(url.GET_AUTH_PRODUCT_CONNECTION, { productId });

/**
 * Keep Product Connection metadata for the UI session.
 * Never persist resolvedConnectionString in browser storage.
 */
export const sanitizeProductConnection = (productConnection) => {
  if (!productConnection || typeof productConnection !== "object") {
    return null;
  }

  const {
    resolvedConnectionString: _secret,
    ...safeFields
  } = productConnection;

  return {
    ...safeFields,
    connectionReady: Boolean(productConnection.resolvedConnectionString),
  };
};

/**
 * SoftOnCloud Countries API
 * GET /api/auth/countries
 */
export const getCountries = () => api.get(url.GET_AUTH_COUNTRIES);

/**
 * Optional SoftOnCloud password-reset APIs
 */
export const postAuthForgotPassword = (data) =>
  api.create(url.POST_AUTH_FORGOT_PASSWORD, data);

export const postAuthVerifyPasswordResetOtp = (data) =>
  api.create(url.POST_AUTH_VERIFY_PASSWORD_RESET_OTP, data);

export const postAuthResendPasswordResetOtp = (data) =>
  api.create(url.POST_AUTH_RESEND_PASSWORD_RESET_OTP, data);

export const postAuthResetPassword = (data) =>
  api.create(url.POST_AUTH_RESET_PASSWORD, data);

export const getConfiguredProductId = () => {
  const fromEnv = appConfig.PRODUCT_ID || process.env.REACT_APP_PRODUCT_ID || "";
  const parsed = parseInt(String(fromEnv).trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Persist SoftOnCloud login session for the UI.
 * Does not store resolvedConnectionString.
 */
export const storeAuthSession = (
  loginResponse,
  productContext = null,
  productConnection = null
) => {
  const token = loginResponse?.token || loginResponse?.accessToken || null;
  const session = {
    ...loginResponse,
    token,
    accessToken: loginResponse?.accessToken || token,
    productContext,
    productConnection: sanitizeProductConnection(productConnection),
  };

  sessionStorage.setItem("authUser", JSON.stringify(session));

  if (token) {
    localStorage.setItem("authToken", token);
    setAuthorization(token);
  }

  return session;
};

export const clearAuthSession = () => {
  sessionStorage.removeItem("authUser");
  localStorage.removeItem("authToken");
  delete axios.defaults.headers.common["Authorization"];
};
