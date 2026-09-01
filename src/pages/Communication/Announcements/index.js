import React from "react";
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
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import CommAvatar from "../components/CommAvatar";
import { announcements } from "../data/staticData";

const Announcements = () => {
  document.title = "Announcements | Chat Module | SoftOnCloud";
  const pinned = announcements.find((a) => a.pinned);

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Announcements" pageTitle="Chat" />

        <Row>
          <Col xl={9}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <Nav className="nav nav-pills nav-success gap-2">
                {["All", "Organization", "Department", "Location", "Important"].map((tab, i) => (
                  <NavItem key={tab}>
                    <NavLink className={classnames({ active: i === 0 }, "fw-medium")} href="#">{tab}</NavLink>
                  </NavItem>
                ))}
              </Nav>
              <div className="d-flex gap-2">
                <Input type="select" bsSize="sm" style={{ width: 150 }}><option>All Categories</option></Input>
                <Input type="select" bsSize="sm" style={{ width: 130 }}><option>Sort: Newest</option></Input>
              </div>
            </div>

            {pinned && (
              <Card className="border-primary border-start border-start-3 mb-3">
                <CardBody>
                  <div className="d-flex gap-2 mb-2">
                    <span className="badge bg-primary-subtle text-primary"><i className="ri-pushpin-line me-1"></i>Pinned</span>
                    <span className="badge bg-primary-subtle text-primary">{pinned.category}</span>
                    <span className="badge bg-danger-subtle text-danger">Important</span>
                  </div>
                  <h5 className="fw-semibold">{pinned.title}</h5>
                  <p className="text-muted">{pinned.preview}</p>
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <div className="d-flex align-items-center gap-2">
                      <CommAvatar id={1} size="xs" />
                      <div>
                        <span className="fw-medium fs-13">{pinned.author}</span>
                        <span className="text-muted fs-12"> · {pinned.role}</span>
                        <div className="text-muted fs-12">{pinned.date}</div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-3">
                      <span className="text-muted fs-12">{pinned.read} read</span>
                      <button className="btn btn-primary btn-sm">View Details</button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}

            {announcements.filter((a) => !a.pinned).map((a) => (
              <Card key={a.id} className="mb-2">
                <CardBody className="d-flex align-items-start gap-3 py-3">
                  <span className="avatar-sm flex-shrink-0">
                    <span className="avatar-title bg-primary-subtle text-primary rounded fs-4">
                      <i className={a.icon || "ri-megaphone-line"}></i>
                    </span>
                  </span>
                  <div className="flex-grow-1">
                    <p className="text-muted fs-12 mb-1">{a.category}</p>
                    <h6 className="mb-1">{a.title}</h6>
                    <p className="text-muted fs-13 mb-0">{a.preview}</p>
                  </div>
                  <div className="text-end flex-shrink-0">
                    <p className="text-muted fs-12 mb-1">{a.date}</p>
                    <span className={`badge bg-${a.status === "Active" ? "success" : a.status === "Expired" ? "secondary" : "warning"}-subtle text-${a.status === "Active" ? "success" : a.status === "Expired" ? "secondary" : "warning"}`}>
                      {a.status}
                    </span>
                    <p className="text-muted fs-12 mt-1 mb-0">{a.read} read</p>
                  </div>
                </CardBody>
              </Card>
            ))}
          </Col>

          <Col xl={3}>
            <Card>
              <CardHeader><h4 className="card-title mb-0">Categories</h4></CardHeader>
              <CardBody className="p-0">
                {[
                  { label: "All Announcements", count: 24, active: true },
                  { label: "HR Department", count: 8 },
                  { label: "IT Department", count: 5 },
                  { label: "Finance Department", count: 4 },
                ].map((cat) => (
                  <Link
                    key={cat.label}
                    to="#"
                    className={`d-flex justify-content-between px-3 py-2 border-bottom text-decoration-none ${cat.active ? "text-primary fw-medium bg-light" : "text-muted"}`}
                  >
                    <span className="fs-13">{cat.label}</span>
                    <span className="badge bg-primary-subtle text-primary">{cat.count}</span>
                  </Link>
                ))}
              </CardBody>
            </Card>
            <Card className="mt-3">
              <CardHeader><h4 className="card-title mb-0">Stats</h4></CardHeader>
              <CardBody>
                {[
                  { label: "Total Announcements", value: 24 },
                  { label: "Total Reads", value: "4,256" },
                  { label: "Unread by Me", value: 3 },
                ].map((s) => (
                  <div key={s.label} className="d-flex justify-content-between mb-2">
                    <span className="text-muted fs-13">{s.label}</span>
                    <span className="fw-medium">{s.value}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Announcements;
