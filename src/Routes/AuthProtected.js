import React, { useEffect } from "react";
import { Navigate, Route } from "react-router-dom";
import { setAuthorization } from "../helpers/api_helper";
import { useDispatch } from "react-redux";

import { useProfile } from "../Components/Hooks/UserHooks";

import { logoutUser } from "../slices/auth/login/thunk";

const BYPASS_AUTH = process.env.REACT_APP_BYPASS_AUTH === "true";

const resolveSessionOrgId = (session) => {
  if (!session || typeof session !== "object") return null;
  const candidates = [
    session.loginOrgId,
    session.orgId,
    session.organizationId,
    session.publicOrgId,
    session.user?.orgId,
    session.user?.organizationId,
    session.productContext?.orgId,
    session.productContext?.organizationId,
  ];
  for (const value of candidates) {
    const n = parseInt(String(value ?? "").trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
};

const AuthProtected = (props) => {
  const dispatch = useDispatch();
  const { userProfile, loading, token } = useProfile();
  const orgId = resolveSessionOrgId(userProfile);
  const hasValidSession = Boolean(token && userProfile && orgId);

  useEffect(() => {
    if (BYPASS_AUTH && !sessionStorage.getItem("authUser")) {
      sessionStorage.setItem(
        "authUser",
        JSON.stringify({
          uid: 1,
          username: "John Doe",
          email: "john.doe@softoncloud.com",
          role: "Manager - Sales",
          token: "demo-static-token",
          orgId: 1,
          organizationId: 1,
          loginOrgId: 1,
        })
      );
    }
  }, []);

  useEffect(() => {
    if (BYPASS_AUTH) return;

    if (hasValidSession) {
      setAuthorization(token);
      return;
    }

    // Missing token / profile / Organization ID → clear session and force login
    if (!loading || (!token && !userProfile)) {
      dispatch(logoutUser());
    }
  }, [token, userProfile, loading, hasValidSession, dispatch]);

  if (!BYPASS_AUTH && !hasValidSession) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: props.location }}
      />
    );
  }

  return <>{props.children}</>;
};

const AccessRoute = ({ component: Component, ...rest }) => {
  return (
    <Route
      {...rest}
      render={(props) => {
        return (
          <>
            <Component {...props} />
          </>
        );
      }}
    />
  );
};

export { AuthProtected, AccessRoute };
