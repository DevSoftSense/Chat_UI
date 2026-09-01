import React from "react";
import { Col, Container, Row } from "reactstrap";
import { Link } from "react-router-dom";
import imgpattern from "../../../assets/images/landing/img-pattern.png";

const heroFeatures = [
  "Inbox, Sent Items & Direct Messaging",
  "Group Chat & Team Channels",
  "Announcements & Organization Updates",
  "Compose with Attachments & Templates",
  "Read Receipts & Message Tracking",
  "Management Dashboard & Analytics",
];

const heroHighlights = [
  { icon: "ri-inbox-line", label: "Smart Inbox" },
  { icon: "ri-group-line", label: "Team Groups" },
  { icon: "ri-megaphone-line", label: "Announcements" },
  { icon: "ri-cloud-line", label: "Cloud Anywhere" },
];

const Home = () => (
  <section className="section pb-0 hero-section" id="hero">
    <div className="bg-overlay bg-overlay-pattern"></div>
    <Container fluid className="hero-container px-3 px-lg-4 px-xl-5">
      <Row className="align-items-center hero-content-row g-4 g-lg-4">
        <Col lg={4} className="order-2 order-lg-1">
          <div className="hero-copy text-center text-lg-start">
            <h1 className="display-6 fw-semibold mb-3 lh-base">
              <span className="text-nowrap">Connect Teams Smarter.</span><br />
              <span className="text-primary">Communicate Faster.</span><br />
              Stay Aligned.
            </h1>
            <p className="lead text-muted lh-base mb-4">
              Chat SoftOnCloud is an end-to-end platform for messaging, group chat,
              announcements, attachments, and real-time team analytics — all in one cloud system.
            </p>
            <ul className="list-unstyled hero-feature-list text-start d-inline-block mb-4">
              {heroFeatures.map((feature) => (
                <li key={feature} className="d-flex align-items-center gap-2 mb-2">
                  <span className="avatar-xs flex-shrink-0">
                    <span className="avatar-title rounded-circle bg-primary-subtle text-primary">
                      <i className="ri-check-line"></i>
                    </span>
                  </span>
                  <span className="fw-medium text-body">{feature}</span>
                </li>
              ))}
            </ul>
            <div className="d-flex flex-wrap gap-2 justify-content-center justify-content-lg-start mb-4">
              <Link to="/communication/dashboard" className="btn btn-primary">Open Dashboard</Link>
              <a href="https://softoncloud.com/" target="_blank" rel="noopener noreferrer" className="btn btn-soft-primary">
                Explore All Apps <i className="ri-arrow-right-line align-middle ms-1"></i>
              </a>
            </div>
            <div className="d-flex flex-nowrap gap-2 gap-lg-3 justify-content-center justify-content-lg-start hero-trust-row">
              {heroHighlights.map((item) => (
                <div key={item.label} className="hero-trust-item text-center text-lg-start">
                  <div className="avatar-xs mx-auto mx-lg-0 mb-1">
                    <span className="avatar-title rounded-circle bg-light text-primary">
                      <i className={item.icon}></i>
                    </span>
                  </div>
                  <div className="fs-12 text-muted fw-medium">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Col>
        <Col lg={8} className="order-1 order-lg-2">
          <div className="demo-carousel">
            <div className="demo-img-patten-top d-none d-sm-block">
              <img src={imgpattern} className="d-block img-fluid" alt="" />
            </div>
            <div className="demo-img-patten-bottom d-none d-sm-block">
              <img src={imgpattern} className="d-block img-fluid" alt="" />
            </div>
            <div className="carousel-inner">
              <img src="/com.png" className="d-block w-100" alt="Chat SoftOnCloud" />
            </div>
          </div>
        </Col>
      </Row>
    </Container>
    <div className="position-absolute start-0 end-0 bottom-0 hero-shape-svg">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120">
        <path d="M 0,118 C 288,98.6 1152,40.4 1440,21L1440 140L0 140z" fill="currentColor"></path>
      </svg>
    </div>
  </section>
);

export default Home;
