import React, { useEffect } from "react";
import Navbar from "./navbar";
import Home from "./home";
import Services from "./services";
import Features from "./features";
import WorkProcess from "./workProcess";
import Faqs from "./faq";
import Contact from "./contact";
import Footer from "./footer";
import { applyLandingSidebarTheme } from "../../../helpers/sidebarTheme";

const CommunicationLanding = () => {
  document.title = "Chat SoftOnCloud | Cloud Chat Module";

  useEffect(() => {
    applyLandingSidebarTheme();
  }, []);

  const scrollFunction = () => {
    const element = document.getElementById("back-to-top");
    if (element) {
      element.style.display =
        document.body.scrollTop > 100 || document.documentElement.scrollTop > 100 ? "block" : "none";
    }
  };

  window.onscroll = scrollFunction;

  const toTop = () => {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  };

  return (
    <div className="layout-wrapper landing">
      <Navbar />
      <Home />
      <Services />
      <Features />
      <WorkProcess />
      <Faqs />
      <Contact />
      <Footer />
      <button type="button" onClick={toTop} className="btn btn-danger btn-icon landing-back-top" id="back-to-top">
        <i className="ri-arrow-up-line"></i>
      </button>
    </div>
  );
};

export default CommunicationLanding;
