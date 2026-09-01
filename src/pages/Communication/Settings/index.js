import React from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Input,
  Label,
  Nav,
  NavItem,
  NavLink,
  Row,
} from "reactstrap";
import classnames from "classnames";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import CommAvatar from "../components/CommAvatar";
import { currentUser } from "../data/staticData";

const Settings = () => {
  document.title = "Settings | Chat Module | SoftOnCloud";

  const cards = [
    {
      title: "Profile & Preferences",
      body: (
        <>
          <div className="d-flex align-items-center gap-3 mb-3">
            <CommAvatar id={1} size="md" />
            <div>
              <h6 className="mb-0">{currentUser.name}</h6>
              <p className="text-muted fs-12 mb-0">{currentUser.role}</p>
            </div>
          </div>
          {["Language", "Time Zone", "Date Format"].map((f) => (
            <div key={f} className="mb-2">
              <Label className="fs-12">{f}</Label>
              <Input type="select" bsSize="sm">
                <option>{f === "Language" ? "English" : f === "Time Zone" ? "IST (UTC+5:30)" : "DD MMM YYYY"}</option>
              </Input>
            </div>
          ))}
          <button className="btn btn-primary btn-sm mt-2">Update Profile</button>
        </>
      ),
    },
    {
      title: "Message Defaults",
      body: (
        <>
          <div className="mb-2">
            <Label className="fs-12">Default Message Type</Label>
            <Input type="select" bsSize="sm"><option>Information</option></Input>
          </div>
          {["Request Read Receipt", "Auto Save Draft"].map((t, i) => (
            <div key={t} className="form-check form-switch mb-2">
              <Input type="checkbox" role="switch" defaultChecked={i === 0 || i === 1} />
              <Label check className="fs-13">{t}</Label>
            </div>
          ))}
        </>
      ),
    },
    {
      title: "Notifications",
      body: (
        <>
          {["Message Received", "Group Messages", "Announcements"].map((n) => (
            <div key={n} className="d-flex justify-content-between align-items-center mb-2">
              <span className="fs-13">{n}</span>
              <Input type="select" bsSize="sm" style={{ width: 90 }}><option>All</option></Input>
            </div>
          ))}
          <button className="btn btn-soft-primary btn-sm mt-2">Manage Rules</button>
        </>
      ),
    },
    {
      title: "Privacy & Security",
      body: (
        <>
          {[
            { label: "Who can message me", value: "Everyone" },
            { label: "Show last seen", value: "Contacts only" },
            { label: "Block List", value: "0 users" },
          ].map((item) => (
            <div key={item.label} className="d-flex justify-content-between py-2 border-bottom">
              <span className="fs-13">{item.label}</span>
              <span className="text-muted fs-12">{item.value} <i className="ri-arrow-right-s-line"></i></span>
            </div>
          ))}
        </>
      ),
    },
    {
      title: "Data & Storage",
      body: (
        <>
          <div className="mb-3">
            <div className="d-flex justify-content-between fs-12 mb-1">
              <span>Storage Used</span><span>2.45 GB / 10 GB</span>
            </div>
            <div className="progress progress-sm">
              <div className="progress-bar bg-primary" style={{ width: "24%" }}></div>
            </div>
          </div>
          <button className="btn btn-soft-primary btn-sm">Manage Storage</button>
        </>
      ),
    },
    {
      title: "Integrations",
      body: (
        <>
          {[
            { name: "Calendar", ok: true },
            { name: "Task Module", ok: true },
            { name: "Email Integration", ok: false },
          ].map((int) => (
            <div key={int.name} className="d-flex justify-content-between py-2 border-bottom">
              <span className="fs-13">{int.name}</span>
              <span className={`badge bg-${int.ok ? "success" : "danger"}-subtle text-${int.ok ? "success" : "danger"}`}>
                {int.ok ? "Enabled" : "Disconnected"}
              </span>
            </div>
          ))}
        </>
      ),
    },
  ];

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Settings" pageTitle="Chat" />

        <Nav className="nav nav-tabs nav-tabs-custom nav-primary mb-4">
          {["General", "Notifications", "Privacy & Security", "Message Defaults", "Data & Storage", "Integrations"].map((tab, i) => (
            <NavItem key={tab}>
              <NavLink className={classnames({ active: i === 0 }, "fw-semibold")} href="#">{tab}</NavLink>
            </NavItem>
          ))}
        </Nav>

        <Row>
          <Col xl={9}>
            <Row className="g-3">
              {cards.map((card) => (
                <Col xl={4} md={6} key={card.title}>
                  <Card className="card-height-100">
                    <CardHeader><h4 className="card-title mb-0 fs-15">{card.title}</h4></CardHeader>
                    <CardBody>{card.body}</CardBody>
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>
          <Col xl={3}>
            <Card>
              <CardHeader><h4 className="card-title mb-0">My Status</h4></CardHeader>
              <CardBody>
                {["Online", "Away", "Busy", "Offline"].map((s, i) => (
                  <div key={s} className="form-check mb-2">
                    <input className="form-check-input" type="radio" name="status" defaultChecked={i === 0} />
                    <label className="form-check-label fs-13">{s}</label>
                  </div>
                ))}
                <Input type="text" bsSize="sm" className="mt-2" defaultValue="In a meeting" />
              </CardBody>
            </Card>
            <Card className="mt-3 bg-primary-subtle border-0">
              <CardBody>
                <p className="text-primary mb-0 fs-13">
                  <i className="ri-lightbulb-line me-1"></i>
                  Enable desktop notifications to never miss important messages.
                </p>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Settings;
