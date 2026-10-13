import PropTypes from "prop-types";
import React, { useEffect } from "react";

import { logoutUser } from "../../slices/thunks";

import { useDispatch } from "react-redux";

import withRouter from "../../Components/Common/withRouter";

const Logout = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    let cancelled = false;
    dispatch(logoutUser())
      .catch(() => {
        /* session clear is best-effort */
      })
      .finally(() => {
        if (cancelled) return;
        // Full navigation clears Redux, hooks, and SignalR without a hard refresh.
        window.location.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return null;
};

Logout.propTypes = {
  history: PropTypes.object,
};


export default withRouter(Logout);