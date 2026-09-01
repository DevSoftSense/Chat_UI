import React from "react";
import { Col, Container, Row } from "reactstrap";
import processArrow from "../../../assets/images/landing/process-arrow-img.png";

const steps = [
  { step: "01", title: "Connect", description: "Set up teams, groups, contacts, and notification preferences.", icon: "ri-user-add-line" },
  { step: "02", title: "Communicate", description: "Send messages, share files, post announcements, and chat in groups daily.", icon: "ri-message-3-line" },
  { step: "03", title: "Analyze", description: "Track read rates, response times, team activity, and AI-powered insights.", icon: "ri-line-chart-line" },
];

const WorkProcess = () => (
  <section className="section bg-light" id="how-it-works">
    <Container>
      <Row className="justify-content-center">
        <Col lg={8}>
          <div className="text-center mb-5">
            <h3 className="mb-3 fw-semibold">How It Works</h3>
            <p className="text-muted mb-0 ff-secondary">Connect → Communicate → Analyze — in three simple steps</p>
          </div>
        </Col>
      </Row>
      <Row className="text-center">
        {steps.map((item, index) => (
          <Col lg={4} key={item.title}>
            <div className="process-card mt-4">
              {index < steps.length - 1 && (
                <div className="process-arrow-img d-none d-lg-block">
                  <img src={processArrow} alt="" className="img-fluid" />
                </div>
              )}
              <div className="avatar-sm icon-effect mx-auto mb-4">
                <div className="avatar-title bg-transparent text-success rounded-circle h1">
                  <i className={item.icon}></i>
                </div>
              </div>
              <p className="text-success fw-semibold mb-2">{item.step}</p>
              <h5>{item.title}</h5>
              <p className="text-muted ff-secondary mb-0">{item.description}</p>
            </div>
          </Col>
        ))}
      </Row>
    </Container>
  </section>
);

export default WorkProcess;
