import React, { useState } from "react";
import { Col, Container, Row, Collapse } from "reactstrap";
import classnames from "classnames";

const faqSections = [
  {
    icon: "ri-question-line",
    title: "General",
    id: "general",
    items: [
      { question: "What is Chat SoftOnCloud?", answer: "A cloud chat platform covering inbox, compose, sent items, group chat, announcements, and management analytics." },
      { question: "Can I message teams and individuals?", answer: "Yes. Send direct messages, group chats, and organization-wide announcements from one unified platform." },
      { question: "Is it cloud-based?", answer: "Yes. Access your communication hub from anywhere with secure cloud login and real-time updates." },
    ],
  },
  {
    icon: "ri-inbox-line",
    title: "Messaging",
    id: "messaging",
    items: [
      { question: "Does it support attachments?", answer: "Yes. Attach Excel, PDF, and other files up to 25 MB with download and preview support." },
      { question: "Are read receipts available?", answer: "Yes. Track delivered, received, and read status for every message with recipient-level details." },
      { question: "Can I use message templates?", answer: "Yes. Compose with templates, quick replies, and saved drafts for faster communication." },
    ],
  },
  {
    icon: "ri-group-line",
    title: "Groups & Announcements",
    id: "groups",
    items: [
      { question: "How do group chats work?", answer: "Create teams, add members, share files, and chat in real time with unread badges and member management." },
      { question: "What types of announcements are supported?", answer: "Organization-wide, department, location, and important announcements with read tracking and expiry status." },
    ],
  },
  {
    icon: "ri-bar-chart-box-line",
    title: "Analytics & AI",
    id: "analytics",
    items: [
      { question: "What analytics are available?", answer: "Message volume, response times, read rates, department activity, and top responder rankings." },
      { question: "Does it include AI insights?", answer: "Yes. AI Assistant provides communication trends, pending reply alerts, and activity peak recommendations." },
    ],
  },
];

const FaqAccordion = ({ items }) => {
  const [openIndex, setOpenIndex] = useState(-1);
  return (
    <div className="accordion custom-accordionwithicon accordion-border-box">
      {items.map((item, index) => (
        <div className="accordion-item" key={item.question}>
          <h2 className="accordion-header">
            <button
              type="button"
              className={classnames("accordion-button fw-medium", { collapsed: openIndex !== index })}
              onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
            >
              {item.question}
            </button>
          </h2>
          <Collapse isOpen={openIndex === index}>
            <div className="accordion-body ff-secondary">{item.answer}</div>
          </Collapse>
        </div>
      ))}
    </div>
  );
};

const Faqs = () => (
  <section className="section" id="faqs">
    <Container>
      <Row className="justify-content-center">
        <Col lg={8}>
          <div className="text-center mb-5">
            <h3 className="mb-3 fw-semibold">Frequently Asked Questions</h3>
            <p className="text-muted mb-4 ff-secondary">Quick answers about Chat SoftOnCloud modules and capabilities.</p>
            <a href="mailto:support@softoncloud.com" className="btn btn-primary rounded-pill">
              <i className="ri-mail-line align-middle me-2"></i>Email Us
            </a>
          </div>
        </Col>
      </Row>
      <Row className="g-lg-5 g-4">
        {faqSections.map((section) => (
          <Col lg={6} key={section.id}>
            <div className="d-flex align-items-center mb-2">
              <i className={`${section.icon} fs-24 text-success me-2`}></i>
              <h5 className="mb-0 fw-semibold">{section.title}</h5>
            </div>
            <FaqAccordion items={section.items} />
          </Col>
        ))}
      </Row>
    </Container>
  </section>
);

export default Faqs;
