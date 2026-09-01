import React, { useEffect } from "react";
import { Navigate, Route } from "react-router-dom";
import { setAuthorization } from "../helpers/api_helper";
import { useDispatch } from "react-redux";

import { useProfile } from "../Components/Hooks/UserHooks";

import { logoutUser } from "../slices/auth/login/thunk";

const BYPASS_AUTH = process.env.REACT_APP_BYPASS_AUTH === "true";

const AuthProtected = (props) =>{
  const dispatch = useDispatch();
  const { userProfile, loading, token } = useProfile();
  
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
        })
      );
    }
  }, []);

  useEffect(() => {
    if (userProfile && !loading && token) {
      setAuthorization(token);
    } else if (!BYPASS_AUTH && !userProfile && loading && !token) {
      dispatch(logoutUser());
    }
  }, [token, userProfile, loading, dispatch]);

  /*
    Navigate is un-auth access protected routes via url
    */

  if (!BYPASS_AUTH && !userProfile && loading && !token) {
    return (
      <Navigate to={{ pathname: "/login", state: { from: props.location } }} />
    );
  }

  return <>{props.children}</>;
};

const AccessRoute = ({ component: Component, ...rest }) => {
  return (
    <Route
      {...rest}
      render={props => {
        return (<> <Component {...props} /> </>);
      }}
    />
  );
};

export { AuthProtected, AccessRoute };