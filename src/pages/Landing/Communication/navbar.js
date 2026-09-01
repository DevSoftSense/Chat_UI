import React, { useState, useEffect } from "react";
import { Collapse, Container, NavbarToggler, NavLink } from "reactstrap";
import Scrollspy from "react-scrollspy";
import { Link } from "react-router-dom";
import { applyLandingSidebarTheme, SIDEBAR_BG } from "../../../helpers/sidebarTheme";

const logoSrc = "/logo.png";

const Navbar = () => {
  const [isOpenMenu, setIsOpenMenu] = useState(false);
  const [navClass, setNavClass] = useState("");

  useEffect(() => {
    applyLandingSidebarTheme();
    window.addEventListener("scroll", scrollNavigation, true);
    return () => window.removeEventListener("scroll", scrollNavigation, true);
  }, []);

  const scrollNavigation = () => {
    setNavClass(document.documentElement.scrollTop > 50 ? "is-sticky" : "");
  };

  return (
    <nav className={`navbar navbar-expand-lg navbar-landing fixed-top ${navClass}`} id="navbar" style={{ background: SIDEBAR_BG }}>
      <Container>
        <Link className="navbar-brand landing-brand" to="/landing">
          <span className="brand-logo-expanded">
            <img src={logoSrc} alt="Chat SoftOnCloud" className="brand-logo-icon" height="50" />
            <span className="brand-logo-text">
              <span className="brand-logo-title">Chat</span>
              <span className="brand-logo-subtitle">SoftOnCloud</span>
            </span>
          </span>
        </Link>

        <NavbarToggler className="navbar-toggler py-0 fs-20" onClick={() => setIsOpenMenu(!isOpenMenu)} type="button">
          <i className="mdi mdi-menu"></i>
        </NavbarToggler>

        <Collapse isOpen={isOpenMenu} className="navbar-collapse" id="navbarSupportedContent">
          <Scrollspy
            offset={-18}
            items={["hero", "services", "features", "faqs", "contact"]}
            currentClassName="active"
            className="navbar-nav mx-auto mt-2 mt-lg-0"
          >
            <li className="nav-item"><NavLink href="#hero">Home</NavLink></li>
            <li className="nav-item"><NavLink href="#services">Modules</NavLink></li>
            <li className="nav-item"><NavLink href="#features">Features</NavLink></li>
            <li className="nav-item"><NavLink href="#faqs">FAQ</NavLink></li>
            <li className="nav-item"><NavLink href="#contact">Contact</NavLink></li>
          </Scrollspy>
          <div>
            <Link to="/login" className="btn btn-link fw-medium text-decoration-none">Sign In</Link>
            <Link to="/register" className="btn btn-light">Sign Up</Link>
          </div>
        </Collapse>
      </Container>
    </nav>
  );
};

export default Navbar;
