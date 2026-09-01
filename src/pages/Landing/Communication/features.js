import React from "react";
import { Col, Container, Row } from "reactstrap";

const useCases = [
  { icon: "ri-building-line", label: "Enterprise Teams" },
  { icon: "ri-store-2-line", label: "Sales Departments" },
  { icon: "ri-customer-service-2-line", label: "Support Teams" },
  { icon: "ri-government-line", label: "Organizations" },
  { icon: "ri-team-line", label: "Remote Teams" },
  { icon: "ri-briefcase-line", label: "Project Groups" },
];

const Features = () => (
  <React.Fragment>
    <section className="section bg-light py-5" id="features">
      <Container>
        <Row className="align-items-center gy-4">
          <Col lg={6} sm={7} className="mx-auto">
            <img src="/tab.png" alt="Chat SoftOnCloud Inbox" className="img-fluid mx-auto" />
          </Col>
          <Col lg={6}>
            <h3 className="mb-4 fs-20 text-body">See Your Messages. Communicate with Confidence.</h3>
            <div className="vstack gap-3">
              {[
                "Unified inbox with unread badges, filters, and message details",
                "Compose messages with attachments, templates, and read receipts",
                "Group chat with files, members, and real-time team messaging",
                "Announcements with organization-wide and department targeting",
                "Management dashboard with analytics, response times, and AI insights",
              ].map((item) => (
                <div key={item} className="d-flex align-items-center">
                  <div className="flex-shrink-0 me-2">
                    <div className="avatar-xs">
                      <div className="avatar-title bg-primary text-white rounded-circle">
                        <i className="ri-check-line"></i>
                      </div>
                    </div>
                  </div>
                  <p className="mb-0 text-body ff-secondary">{item}</p>
                </div>
              ))}
            </div>
          </Col>
        </Row>
      </Container>
    </section>

    <section className="section">
      <Container>
        <Row className="align-items-center gy-4">
          <Col lg={6} className="order-2 order-lg-1">
            <h3 className="mb-4 fs-20 text-body">Built for Every Team Type</h3>
            <Row className="g-3 mb-4">
              {useCases.map((type) => (
                <Col xs={6} sm={4} lg={6} xl={4} key={type.label}>
                  <div className="landing-property-card text-center p-3 bg-light rounded w-100">
                    <div className="avatar-sm mx-auto mb-2">
                      <div className="avatar-title bg-white text-primary rounded">
                        <i className={`${type.icon} fs-20`}></i>
                      </div>
                    </div>
                    <p className="mb-0 fw-medium text-body fs-14">{type.label}</p>
                  </div>
                </Col>
              ))}
            </Row>
            <p className="mb-0 ff-secondary text-body">
              From sales teams to support groups, Chat SoftOnCloud keeps everyone
              connected with messaging, announcements, and analytics in real time.
            </p>
          </Col>
          <Col lg={6} sm={7} className="order-1 order-lg-2">
            <img src="/allnew.png" alt="Chat Dashboard" className="img-fluid" />
          </Col>
        </Row>
      </Container>
    </section>
  </React.Fragment>
);

export default Features;
