import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Nav,
  NavItem,
  NavLink,
  Row,
  UncontrolledDropdown,
} from "reactstrap";
import classnames from "classnames";
import SimpleBar from "simplebar-react";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import CommAvatar from "../components/CommAvatar";
import { inboxMessages } from "../data/staticData";

const Inbox = () => {
  document.title = "Inbox | Chat Module | SoftOnCloud";
  const [activeMsg, setActiveMsg] = useState(inboxMessages[0]);
  const [activeTab, setActiveTab] = useState("all");

  const tabs = ["all", "unread", "mentions", "important", "groups"];
  const tabLabels = {
    all: "All",
    unread: "Unread (24)",
    mentions: "Mentions",
    important: "Important",
    groups: "Groups",
  };

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Inbox" pageTitle="Chat" />

        <div className="email-wrapper d-lg-flex gap-1 mx-n4 mt-n4 p-1">
          {/* Message list */}
          <div className="email-content flex-grow-1">
            <div className="p-4 pb-0">
              <Row className="align-items-end">
                <Col>
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <h5 className="mb-0 fw-semibold">Inbox</h5>
                    <span className="badge bg-danger-subtle text-danger">24 Unread</span>
                  </div>
                  <Nav
                    className="nav nav-tabs nav-tabs-custom nav-success gap-1 border-bottom-0"
                    role="tablist"
                  >
                    {tabs.map((tab) => (
                      <NavItem key={tab}>
                        <NavLink
                          className={classnames({ active: activeTab === tab }, "fw-semibold")}
                          onClick={() => setActiveTab(tab)}
                          href="#"
                        >
                          {tabLabels[tab]}
                        </NavLink>
                      </NavItem>
                    ))}
                  </Nav>
                </Col>
                <Col xs="auto">
                  <div className="d-flex gap-1">
                    <button type="button" className="btn btn-ghost-secondary btn-icon btn-sm fs-16">
                      <i className="ri-filter-3-line align-bottom"></i>
                    </button>
                    <UncontrolledDropdown>
                      <DropdownToggle tag="button" className="btn btn-ghost-secondary btn-icon btn-sm fs-16">
                        <i className="ri-more-2-fill align-bottom"></i>
                      </DropdownToggle>
                      <DropdownMenu className="dropdown-menu-end">
                        <DropdownItem>Mark all as Read</DropdownItem>
                        <DropdownItem>Archive All</DropdownItem>
                      </DropdownMenu>
                    </UncontrolledDropdown>
                  </div>
                </Col>
              </Row>
            </div>

            <div className="message-list-content mx-n4 px-4 message-list-scroll">
              <ul className="message-list">
                {inboxMessages.map((msg) => (
                  <li
                    key={msg.id}
                    className={classnames({ unread: msg.unread > 0, active: activeMsg.id === msg.id })}
                    onClick={() => setActiveMsg(msg)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="col-mail col-mail-1">
                      <button type="button" className="btn avatar-xs p-0 favourite-btn fs-15">
                        <i className="ri-star-fill"></i>
                      </button>
                      <span className="title">{msg.sender}</span>
                    </div>
                    <div className="col-mail col-mail-2">
                      <span className="subject">
                        {msg.subject} - <span className="teaser">{msg.preview}</span>
                      </span>
                      <div className="date">{msg.time}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="text-center py-3">
                <Link to="#" className="text-primary fs-13">
                  Load more messages <i className="ri-arrow-down-line align-middle"></i>
                </Link>
              </div>
            </div>
          </div>

          {/* Message detail */}
          <div className="email-detail-content" style={{ display: "block" }}>
            <div className="p-4 d-flex flex-column h-100">
              <div className="pb-4 border-bottom border-bottom-dashed">
                <Row>
                  <Col>
                    <div className="hstack gap-2 flex-wrap">
                      {["Reply", "Forward", "Star", "Delete"].map((action) => (
                        <button key={action} type="button" className="btn btn-soft-secondary btn-sm">
                          {action}
                        </button>
                      ))}
                    </div>
                  </Col>
                  <Col xs="auto">
                    <div className="hstack gap-sm-1">
                      <button type="button" className="btn btn-ghost-secondary btn-icon btn-sm fs-16">
                        <i className="ri-printer-fill align-bottom"></i>
                      </button>
                      <UncontrolledDropdown>
                        <DropdownToggle tag="button" className="btn btn-ghost-secondary btn-icon btn-sm fs-16">
                          <i className="ri-more-2-fill align-bottom"></i>
                        </DropdownToggle>
                        <DropdownMenu className="dropdown-menu-end">
                          <DropdownItem>Mark as Unread</DropdownItem>
                          <DropdownItem>Archive Message</DropdownItem>
                        </DropdownMenu>
                      </UncontrolledDropdown>
                    </div>
                  </Col>
                </Row>
              </div>

              <SimpleBar className="mx-n4 px-4 email-detail-content-scroll flex-grow-1">
                <div className="mt-4 mb-3">
                  <div className="d-flex align-items-start gap-3">
                    <CommAvatar id={activeMsg.id} size="md" />
                    <div className="flex-grow-1">
                      <h5 className="fw-semibold mb-1">{activeMsg.sender}</h5>
                      <p className="text-muted fs-12 mb-1">To: John Doe · Sales Executive</p>
                      <span className="badge bg-success-subtle text-success fs-10">
                        <i className="ri-record-circle-fill align-middle me-1"></i> Online
                      </span>
                      <span className="text-muted fs-12 ms-2">
                        {activeMsg.time}, {activeMsg.date}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card border shadow-none mb-4">
                  <div className="card-body">
                    <h5 className="fw-semibold mb-3">{activeMsg.subject}</h5>
                    <p className="text-muted mb-0">
                      Hi John,
                      <br /><br />
                      Please review the attached sales target report for Q2. We need your feedback before the team meeting on Friday.
                      <br /><br />
                      Let me know if you have any questions.
                      <br /><br />
                      Best regards,
                      <br />
                      Emily Davis
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <h6 className="fs-13 fw-semibold mb-2">Attachments (1)</h6>
                  <div className="border rounded p-3 d-flex align-items-center gap-3">
                    <div className="avatar-sm flex-shrink-0">
                      <span className="avatar-title bg-success-subtle text-success rounded fs-4">
                        <i className="ri-file-excel-2-line"></i>
                      </span>
                    </div>
                    <div className="flex-grow-1">
                      <h6 className="fs-13 mb-0">Q2_Sales_Target_Report.xlsx</h6>
                      <small className="text-muted">1.25 MB</small>
                    </div>
                    <button className="btn btn-soft-primary btn-sm btn-icon">
                      <i className="ri-download-2-line"></i>
                    </button>
                  </div>
                </div>

                <div className="d-flex gap-2 flex-wrap mb-3">
                  {["Got it", "Will do", "Let's discuss", "Thanks", "+ Add"].map((r) => (
                    <button key={r} className="btn btn-soft-secondary btn-sm rounded-pill">
                      {r}
                    </button>
                  ))}
                </div>
              </SimpleBar>

              <div className="mt-auto pt-3">
                <form>
                  <label className="form-label">Reply :</label>
                  <textarea
                    className="form-control border-bottom-0 rounded-top rounded-0 border"
                    rows="3"
                    placeholder="Type your message..."
                  ></textarea>
                  <div className="bg-light px-2 py-2 rounded-bottom border">
                    <Row className="align-items-center">
                      <Col>
                        <ButtonGroup>
                          <Button size="sm" color="light" className="py-0 fs-15">
                            <i className="ri-emotion-line align-bottom"></i>
                          </Button>
                          <Button size="sm" color="light" className="py-0 fs-15">
                            <i className="ri-attachment-2 align-bottom"></i>
                          </Button>
                          <Button size="sm" color="light" className="py-0 fs-15">
                            <i className="ri-image-2-line align-bottom"></i>
                          </Button>
                        </ButtonGroup>
                      </Col>
                      <Col xs="auto">
                        <Button color="success" size="sm">
                          <i className="ri-send-plane-2-fill align-bottom"></i>
                        </Button>
                      </Col>
                    </Row>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Details sidebar */}
          <div className="email-menu-sidebar border-start" style={{ width: 280, minWidth: 280 }}>
            <div className="p-4">
              <Nav className="nav nav-tabs nav-tabs-custom nav-primary mb-3">
                <NavItem>
                  <NavLink className="active fw-semibold" href="#">Details</NavLink>
                </NavItem>
                <NavItem>
                  <NavLink href="#">People (2)</NavLink>
                </NavItem>
              </Nav>

              <div className="vstack gap-3">
                <div>
                  <p className="text-muted fs-12 mb-1">Message ID</p>
                  <p className="fw-medium fs-13 mb-0">MSG-2025-08-14-0001</p>
                </div>
                <div>
                  <p className="text-muted fs-12 mb-1">Priority</p>
                  <span className="badge bg-warning-subtle text-warning">Normal</span>
                </div>
                <div>
                  <p className="text-muted fs-12 mb-1">Type</p>
                  <span className="badge bg-primary-subtle text-primary">Direct Message</span>
                </div>
                <div>
                  <p className="text-muted fs-12 mb-2">Status Timeline</p>
                  {[
                    { label: "Delivered", time: "10:30 AM" },
                    { label: "Received", time: "10:30 AM" },
                    { label: "Read", time: "10:32 AM" },
                  ].map((s) => (
                    <div key={s.label} className="d-flex align-items-center gap-2 mb-2">
                      <i className="ri-checkbox-circle-fill text-success"></i>
                      <span className="fs-13">{s.label}</span>
                      <span className="text-muted fs-12 ms-auto">{s.time}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-muted fs-12 mb-1">Location</p>
                  <p className="fs-13 mb-0">Sales Department</p>
                </div>
                <div>
                  <p className="text-muted fs-12 mb-1">Tags</p>
                  <span className="badge bg-primary-subtle text-primary me-1">Sales</span>
                  <span className="badge bg-secondary-subtle text-secondary">Report</span>
                </div>
              </div>

              <hr className="my-3" />

              <div className="vstack gap-2">
                {["Mark as Unread", "Star Message", "Archive Message"].map((action) => (
                  <Link key={action} to="#" className="text-muted fs-13 text-decoration-none">
                    <i className="ri-arrow-right-s-line align-middle me-1"></i> {action}
                  </Link>
                ))}
                <Link to="#" className="text-danger fs-13 text-decoration-none">
                  <i className="ri-delete-bin-line align-middle me-1"></i> Delete Message
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default Inbox;
