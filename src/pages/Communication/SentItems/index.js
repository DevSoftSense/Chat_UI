import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Input,
  Nav,
  NavItem,
  NavLink,
  Row,
} from "reactstrap";
import classnames from "classnames";
import SimpleBar from "simplebar-react";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import CommAvatar from "../components/CommAvatar";
import { sentMessages, contacts } from "../data/staticData";

const SentItems = () => {
  document.title = "Sent Items | Chat Module | SoftOnCloud";
  const [activeMsg, setActiveMsg] = useState(sentMessages[0]);

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Sent Items" pageTitle="Chat" />

        <div className="email-wrapper d-lg-flex gap-1 mx-n4 mt-n4 p-1">
          <div className="email-content" style={{ maxWidth: 380 }}>
            <div className="p-4 pb-0">
              <h5 className="fw-semibold mb-3">Sent Items</h5>
              <Nav className="nav nav-tabs nav-tabs-custom nav-primary gap-1 border-bottom-0 mb-3">
                {["All", "Today", "Yesterday", "This Week", "This Month"].map((tab, i) => (
                  <NavItem key={tab}>
                    <NavLink className={classnames({ active: i === 0 }, "fw-semibold")} href="#">
                      {tab}
                    </NavLink>
                  </NavItem>
                ))}
              </Nav>
              <Input type="text" placeholder="Search sent messages..." bsSize="sm" className="mb-2" />
            </div>
            <div className="message-list-content mx-n4 px-4 message-list-scroll">
              <ul className="message-list">
                {sentMessages.map((msg) => (
                  <li
                    key={msg.id}
                    className={classnames({ active: activeMsg.id === msg.id })}
                    onClick={() => setActiveMsg(msg)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="col-mail col-mail-1">
                      <span className="title">{msg.to}</span>
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
              <div className="d-flex justify-content-between align-items-center p-3 fs-12 text-muted">
                <span>1-9 of 56 messages</span>
              </div>
            </div>
          </div>

          <div className="email-detail-content flex-grow-1" style={{ display: "block" }}>
            <div className="p-4 d-flex flex-column h-100">
              <div className="pb-3 border-bottom border-bottom-dashed">
                <div className="hstack gap-2 flex-wrap">
                  {["Reply", "Reply All", "Forward", "Star", "Archive", "Delete"].map((a) => (
                    <button key={a} type="button" className="btn btn-soft-secondary btn-sm">{a}</button>
                  ))}
                </div>
              </div>
              <SimpleBar className="flex-grow-1 mx-n4 px-4">
                <div className="mt-4 d-flex align-items-start gap-3 mb-3">
                  <CommAvatar id={1} size="md" />
                  <div className="flex-grow-1">
                    <h5 className="fw-semibold mb-1">{activeMsg.subject}</h5>
                    <p className="text-muted fs-12 mb-1">To: {activeMsg.to}</p>
                    <p className="text-muted fs-12">Today, 9:15 AM, 14 Aug 2025</p>
                  </div>
                  <span className="badge bg-success-subtle text-success">Completed</span>
                </div>
                <div className="card border shadow-none mb-4">
                  <div className="card-body text-muted">
                    Hello Team,<br /><br />
                    Please find the monthly sales update report attached. Kindly review the details and share your feedback.<br /><br />
                    Regards,<br />John Doe
                  </div>
                </div>
                <div className="mb-4">
                  <h6 className="fs-13 fw-semibold mb-2">Attachments (2)</h6>
                  <Row className="g-2">
                    {[
                      { name: "Sales_Report_July_2025.xlsx", size: "1.25 MB", type: "success", icon: "ri-file-excel-2-line" },
                      { name: "Target_Achievement_Summary.pdf", size: "2.40 MB", type: "danger", icon: "ri-file-pdf-line" },
                    ].map((f) => (
                      <Col md={6} key={f.name}>
                        <div className="border rounded p-3 d-flex align-items-center gap-2">
                          <span className={`avatar-title bg-${f.type}-subtle text-${f.type} rounded fs-4`}>
                            <i className={f.icon}></i>
                          </span>
                          <div className="flex-grow-1 overflow-hidden">
                            <h6 className="fs-12 mb-0 text-truncate">{f.name}</h6>
                            <small className="text-muted">{f.size}</small>
                          </div>
                          <button className="btn btn-soft-primary btn-sm btn-icon"><i className="ri-download-2-line"></i></button>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>
                <Card className="border shadow-none">
                  <CardHeader className="py-2">
                    <div className="d-flex justify-content-between align-items-center">
                      <h6 className="mb-0 fs-13">Recipients Status</h6>
                      <div className="d-flex gap-2 fs-12">
                        <span className="text-success">12 Read</span>
                        <span className="text-info">3 Received</span>
                        <span className="text-warning">3 Pending</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody className="py-2">
                    {contacts.slice(0, 5).map((c) => (
                      <div key={c.id} className="d-flex align-items-center gap-2 mb-2">
                        <CommAvatar id={c.id} size="xs" />
                        <div className="flex-grow-1">
                          <span className="fs-13 fw-medium">{c.name}</span>
                          <small className="text-muted d-block">{c.role}</small>
                        </div>
                        <i className="ri-check-double-line text-success"></i>
                        <small className="text-muted">10:32 AM</small>
                      </div>
                    ))}
                    <Link to="#" className="fs-12 text-primary">+ 13 more recipients</Link>
                  </CardBody>
                </Card>
              </SimpleBar>
            </div>
          </div>

          <div className="email-menu-sidebar border-start" style={{ width: 260, minWidth: 260 }}>
            <div className="p-4">
              <div className="d-flex justify-content-between mb-3">
                <h6 className="mb-0">Filters</h6>
                <Link to="#" className="fs-12 text-primary">Clear</Link>
              </div>
              <div className="mb-3">
                <label className="form-label fs-12">Message Type</label>
                <Input type="select" bsSize="sm"><option>All Types</option></Input>
              </div>
              <div className="mb-3">
                <label className="form-label fs-12">Date Range</label>
                <Input type="select" bsSize="sm"><option>This Month</option></Input>
              </div>
              {["All", "Read", "Received", "Pending"].map((s, i) => (
                <div key={s} className="form-check mb-1">
                  <input className="form-check-input" type="checkbox" defaultChecked={i === 0} />
                  <label className="form-check-label fs-13">{s}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default SentItems;
