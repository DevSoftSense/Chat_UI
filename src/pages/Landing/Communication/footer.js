import React from "react";
import { Link } from "react-router-dom";
import { Col, Container, Input, Row } from "reactstrap";

const Footer = () => (
  <footer className="custom-footer landing-footer bg-dark py-5">
    <Container>
      <Row className="g-4">
        <Col lg={4} md={6}>
          <Link to="/landing" className="landing-footer-brand text-decoration-none">
            <img src="/logo.png" alt="Chat SoftOnCloud" height="40" />
            <span className="ms-2">
              <span className="landing-footer-brand-title">Chat</span>
              <span className="landing-footer-brand-subtitle">SoftOnCloud</span>
            </span>
          </Link>
          <p className="text-muted mt-4 mb-4 ff-secondary">
            One cloud platform for inbox, group chat, announcements, attachments, and team communication analytics.
          </p>
        </Col>
        <Col lg={2} md={6}>
          <h5 className="text-white mb-3">Modules</h5>
          <ul className="list-unstyled ff-secondary footer-list">
            <li><Link to="/communication/inbox">Inbox</Link></li>
            <li><Link to="/communication/groups">Groups</Link></li>
            <li><Link to="/communication/announcements">Announcements</Link></li>
            <li><Link to="/communication/management">Analytics</Link></li>
            <li><Link to="/communication/settings">Settings</Link></li>
          </ul>
        </Col>
        <Col lg={2} md={6}>
          <h5 className="text-white mb-3">Company</h5>
          <ul className="list-unstyled ff-secondary footer-list">
            <li><a href="https://softoncloud.com/" target="_blank" rel="noopener noreferrer">About</a></li>
            <li><Link to="/landing#contact">Contact</Link></li>
            <li><Link to="/landing#faqs">Help</Link></li>
          </ul>
        </Col>
        <Col lg={4} md={6}>
          <h5 className="text-white mb-3">Newsletter</h5>
          <p className="text-muted ff-secondary mb-3">Stay updated with communication platform features.</p>
          <div className="input-group">
            <Input type="email" placeholder="Enter your email" />
            <button type="button" className="btn btn-primary"><i className="ri-send-plane-2-fill"></i></button>
          </div>
        </Col>
      </Row>
      <div className="text-center text-muted mt-5 pt-3">
        {/* © {new Date().getFullYear()} SoftOnCloud Chat. All rights reserved. */}
        © Powered by SoftOnCloud. All rights reserved.
      </div>
    </Container>
  </footer>
);

export default Footer;
