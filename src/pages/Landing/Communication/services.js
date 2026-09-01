import React from "react";
import { Col, Container, Row } from "reactstrap";

const serviceItems = [
  { icon: "ri-inbox-line", title: "Inbox", description: "Unified inbox with unread counts, filters, attachments, and quick replies for every conversation." },
  { icon: "ri-send-plane-line", title: "Sent Items", description: "Track sent messages, delivery status, read receipts, and recipient-level analytics." },
  { icon: "ri-edit-box-line", title: "Compose", description: "Rich compose with recipients, templates, attachments, priority, and read receipt options." },
  { icon: "ri-group-line", title: "Groups", description: "Team channels with group chat, shared files, member management, and real-time messaging." },
  { icon: "ri-megaphone-line", title: "Announcements", description: "Organization-wide, department, and important announcements with read tracking." },
  { icon: "ri-bar-chart-box-line", title: "Management Dashboard", description: "Communication analytics, response times, team performance, and AI insights." },
  { icon: "ri-user-smile-line", title: "Online Status", description: "See who's online, away, or offline with favorite contacts and presence indicators." },
  { icon: "ri-settings-3-line", title: "Settings", description: "Notifications, privacy, message defaults, integrations, and storage management." },
];

const Services = () => (
  <section className="section" id="services">
    <Container>
      <Row className="justify-content-center">
        <Col lg={8}>
          <div className="text-center mb-5">
            <h5 className="fs-12 text-uppercase text-success mb-2">Complete Modules</h5>
            <h3 className="mb-3 fw-semibold">Everything You Need for Team Communication</h3>
            <p className="text-muted mb-0 ff-secondary">
              From inbox to announcements, groups to analytics — one cloud platform built for modern workplace communication.
            </p>
          </div>
        </Col>
      </Row>
      <Row className="g-3">
        {serviceItems.map((item) => (
          <Col lg={3} md={6} key={item.title}>
            <div className="d-flex p-3">
              <div className="flex-shrink-0 me-3">
                <div className="avatar-sm icon-effect">
                  <div className="avatar-title bg-transparent text-success rounded-circle">
                    <i className={`${item.icon} fs-36`}></i>
                  </div>
                </div>
              </div>
              <div className="flex-grow-1">
                <h5 className="fs-18">{item.title}</h5>
                <p className="text-muted mb-0 ff-secondary">{item.description}</p>
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </Container>
  </section>
);

export default Services;
