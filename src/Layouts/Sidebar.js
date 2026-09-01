import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import SimpleBar from "simplebar-react";
import { APP_LOGO } from "../helpers/branding";
import VerticalLayout from "./VerticalLayouts";
import TwoColumnLayout from "./TwoColumnLayout";
import { Container } from "reactstrap";
import HorizontalLayout from "./HorizontalLayout";

const LogoBox = ({ light = false }) => (
  <>
    <span className="logo-sm">
      <div className="d-flex justify-content-center align-items-center" style={{ height: "70px" }}>
        <div
          className="shadow-sm"
          style={{
            background: "#fff",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "42px",
            height: "42px",
            overflow: "hidden",
          }}
        >
          <img src={APP_LOGO} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      </div>
    </span>
    <span className="logo-lg">
      <div className="d-flex align-items-center" style={{ height: "70px" }}>
        <div
          className="shadow-sm"
          style={{
            background: "#fff",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "50px",
            height: "50px",
            minWidth: "50px",
            overflow: "hidden",
          }}
        >
          <img src={APP_LOGO} alt="Logo" style={{ width: "110%", height: "110%", objectFit: "contain" }} />
        </div>
        <div className="ms-2 text-start d-flex flex-column justify-content-center" style={{ height: "50px" }}>
          <h3
            className={`mb-0 fw-bolder ${light ? "text-white" : "text-dark"}`}
            style={{ fontSize: "22px", letterSpacing: "0px", lineHeight: "1" }}
          >
            Chat
          </h3>
          <span
            className={`mt-1 ${light ? "text-white-50" : "text-muted"}`}
            style={{ fontSize: "13px", fontWeight: "500", letterSpacing: "0.2px", lineHeight: "1" }}
          >
            SoftOnCloud
          </span>
        </div>
      </div>
    </span>
  </>
);

const Sidebar = ({ layoutType }) => {
  useEffect(() => {
    const verticalOverlay = document.getElementsByClassName("vertical-overlay");
    if (verticalOverlay[0]) {
      verticalOverlay[0].addEventListener("click", () => {
        document.body.classList.remove("vertical-sidebar-enable");
      });
    }
  }, []);

  const addEventListenerOnSmHoverMenu = () => {
    const size = document.documentElement.getAttribute("data-sidebar-size");
    if (size === "sm-hover") {
      document.documentElement.setAttribute("data-sidebar-size", "sm-hover-active");
    } else if (size === "sm-hover-active") {
      document.documentElement.setAttribute("data-sidebar-size", "sm-hover");
    } else {
      document.documentElement.setAttribute("data-sidebar-size", "sm-hover");
    }
  };

  return (
    <React.Fragment>
      <div className="app-menu navbar-menu">
        <div className="navbar-brand-box">
          <Link to="/landing" className="logo logo-dark">
            <LogoBox />
          </Link>
          <Link to="/landing" className="logo logo-light">
            <LogoBox light />
          </Link>
          <button
            onClick={addEventListenerOnSmHoverMenu}
            type="button"
            className="btn btn-sm p-0 fs-20 header-item float-end btn-vertical-sm-hover"
            id="vertical-hover"
          >
            <i className="ri-record-circle-line"></i>
          </button>
        </div>
        {layoutType === "horizontal" ? (
          <div id="scrollbar">
            <Container fluid>
              <div id="two-column-menu"></div>
              <ul className="navbar-nav" id="navbar-nav">
                <HorizontalLayout />
              </ul>
            </Container>
          </div>
        ) : layoutType === "twocolumn" ? (
          <React.Fragment>
            <TwoColumnLayout layoutType={layoutType} />
            <div className="sidebar-background"></div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <SimpleBar id="scrollbar" className="h-100">
              <Container fluid>
                <div id="two-column-menu"></div>
                <ul className="navbar-nav" id="navbar-nav">
                  <VerticalLayout layoutType={layoutType} />
                </ul>
              </Container>
            </SimpleBar>
            <div className="sidebar-background"></div>
          </React.Fragment>
        )}
      </div>
      <div className="vertical-overlay"></div>
    </React.Fragment>
  );
};

export default Sidebar;
