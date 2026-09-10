import { getFirebaseBackend } from "../../../helpers/firebase_helper";
import {
  postFakeLogin,
  postSocialLogin,
} from "../../../helpers/fakebackend_helper";
import {
  postAuthLogin,
  resolveUserContext,
  getProductConnection,
  getConfiguredProductId,
  storeAuthSession,
  clearAuthSession,
} from "../../../helpers/softoncloud_auth_helper";

import {
  loginBegin,
  loginSuccess,
  logoutUserSuccess,
  apiError,
  reset_login_flag,
} from "./reducer";

const getErrorMessage = (error) => {
  if (!error) return "Login failed.";
  if (typeof error === "string") return error;
  if (error.message && typeof error.message === "string") return error.message;
  if (error.data && typeof error.data === "string") return error.data;
  if (error.data?.message) return error.data.message;
  return "Login failed.";
};

/**
 * SoftOnCloud login flow:
 * 1) POST /api/auth/login
 * 2) Store JWT + profile
 * 3) GET /api/auth/resolve-context?productId={productId}
 * 4) GET /api/auth/product-connection?productId={productId} (Bearer JWT)
 * 5) Enable product UI using roles / plan / limits
 */
export const loginUser = (user, history) => async (dispatch) => {
  try {
    dispatch(loginBegin());

    if (process.env.REACT_APP_DEFAULTAUTH === "firebase") {
      const fireBaseBackend = getFirebaseBackend();
      const response = await fireBaseBackend.loginUser(user.email, user.password);
      if (response) {
        sessionStorage.setItem("authUser", JSON.stringify(response));
        dispatch(loginSuccess(response));
        history("/dashboard");
      }
      return;
    }

    if (process.env.REACT_APP_DEFAULTAUTH === "fake") {
      const response = await postFakeLogin({
        email: user.email,
        password: user.password,
      });
      const finallogin = typeof response === "string" ? JSON.parse(response) : response;
      if (finallogin.status === "success") {
        sessionStorage.setItem("authUser", JSON.stringify(finallogin.data));
        dispatch(loginSuccess(finallogin.data));
        history("/dashboard");
      } else {
        dispatch(apiError({ data: getErrorMessage(finallogin) }));
      }
      return;
    }

    // SoftOnCloud JWT auth (default)
    const loginResponse = await postAuthLogin({
      organizationId: String(user.organizationId || "").trim(),
      email: String(user.email || "").trim(),
      password: user.password,
      rememberMe: Boolean(user.rememberMe),
    });

    if (!loginResponse) {
      dispatch(apiError({ data: "Login failed." }));
      return;
    }

    const token = loginResponse.token || loginResponse.accessToken;
    if (!token) {
      dispatch(apiError({ data: "Login succeeded but no token was returned." }));
      return;
    }

    // Store JWT + profile from login response
    let session = storeAuthSession(loginResponse, null);

    const productId = getConfiguredProductId();
    if (!productId) {
      clearAuthSession();
      dispatch(apiError({
        data: "Product ID is not configured. Set REACT_APP_PRODUCT_ID in the UI .env file.",
      }));
      return;
    }

    // Authorization — ResolveUserContext
    let productContext;
    try {
      productContext = await resolveUserContext(productId);
    } catch (resolveError) {
      clearAuthSession();
      const status = resolveError?.status;
      if (status === 401) {
        dispatch(apiError({
          data: getErrorMessage(resolveError) || "Session expired. Please sign in again.",
        }));
      } else if (status === 403) {
        dispatch(apiError({
          data: getErrorMessage(resolveError) || "You do not have access to this product.",
        }));
      } else {
        dispatch(apiError({ data: getErrorMessage(resolveError) }));
      }
      return;
    }

    const accessGranted =
      productContext?.accessGranted === true ||
      productContext?.hasAccess === true ||
      productContext?.has_access === true;

    if (productContext && accessGranted === false) {
      clearAuthSession();
      dispatch(apiError({
        data: productContext?.denialReason
          ? `Access denied (${productContext.denialReason})`
          : "You do not have access to this product.",
      }));
      return;
    }

    // Product Connection (Transaction DB) — existing SoftOnCloud API
    // GET /api/auth/product-connection?productId={id}
    // Authorization: Bearer <JWT from login>
    let productConnection;
    try {
      productConnection = await getProductConnection(productId);
    } catch (connectionError) {
      clearAuthSession();
      const status = connectionError?.status;
      if (status === 401) {
        dispatch(apiError({
          data:
            getErrorMessage(connectionError) ||
            "Your session has ended. Please sign in again to continue.",
        }));
      } else if (status === 403) {
        dispatch(apiError({
          data:
            getErrorMessage(connectionError) ||
            "Product connection is unavailable for this product.",
        }));
      } else {
        dispatch(apiError({ data: getErrorMessage(connectionError) }));
      }
      return;
    }

    if (!productConnection?.resolvedConnectionString) {
      clearAuthSession();
      dispatch(apiError({
        data: "Product connection succeeded but resolvedConnectionString was not returned.",
      }));
      return;
    }

    session = storeAuthSession(loginResponse, productContext, productConnection);
    dispatch(loginSuccess(session));
    history("/communication/dashboard");
  } catch (error) {
    clearAuthSession();
    dispatch(apiError({ data: getErrorMessage(error) }));
  }
};

export const logoutUser = () => async (dispatch) => {
  try {
    clearAuthSession();
    if (process.env.REACT_APP_DEFAULTAUTH === "firebase") {
      const fireBaseBackend = getFirebaseBackend();
      dispatch(logoutUserSuccess(fireBaseBackend.logout));
    } else {
      dispatch(logoutUserSuccess(true));
    }
  } catch (error) {
    dispatch(apiError({ data: getErrorMessage(error) }));
  }
};

export const socialLogin = (type, history) => async (dispatch) => {
  try {
    dispatch(loginBegin());
    let response;

    if (process.env.REACT_APP_DEFAULTAUTH === "firebase") {
      const fireBaseBackend = getFirebaseBackend();
      response = fireBaseBackend.socialLoginUser(type);
    } else {
      response = postSocialLogin(type);
    }

    const socialdata = await response;
    if (socialdata) {
      sessionStorage.setItem("authUser", JSON.stringify(socialdata));
      dispatch(loginSuccess(socialdata));
      history("/dashboard");
    }
  } catch (error) {
    dispatch(apiError({ data: getErrorMessage(error) }));
  }
};

export const resetLoginFlag = () => async (dispatch) => {
  try {
    return dispatch(reset_login_flag());
  } catch (error) {
    dispatch(apiError({ data: getErrorMessage(error) }));
  }
};
