import React from "react";
import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader, Col, Container, Row } from "reactstrap";
import ReactApexChart from "react-apexcharts";
import CountUp from "react-countup";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import CommAvatar from "../components/CommAvatar";
import {
  currentUser,
  dashboardStats,
  inboxMessages,
  sentMessages,
  announcements,
  favoriteContacts,
} from "../data/staticData";

const statTheme = {
  "Unread Messages": { bgcolor: "primary", icon: "ri-mail-unread-line" },
  "Sent Today": { bgcolor: "success", icon: "ri-send-plane-2-line" },
  "Online Employees": { bgcolor: "info", icon: "ri-user-smile-line" },
  "Pending Reads": { bgcolor: "warning", icon: "ri-time-line" },
  Announcements: { bgcolor: "danger", icon: "ri-megaphone-line" },
  Drafts: { bgcolor: "secondary", icon: "ri-draft-line" },
};

const Dashboard = () => {
  document.title = "Dashboard | Chat Module | SoftOnCloud";

  const deptChart = {
    series: [35, 22, 18, 15, 10],
    options: {
      chart: { type: "donut" },
      labels: ["Sales", "IT", "HR", "Finance", "Other"],
      colors: ["#405189", "#0ab39c", "#f7b84b", "#f06548", "#878a99"],
      legend: { position: "right", fontSize: "12px" },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: "65%",
            labels: {
              show: true,
              total: { show: true, label: "Total", formatter: () => "312 Messages" },
            },
          },
        },
      },
    },
  };

  const readChart = {
    series: [63, 37],
    options: {
      chart: { type: "donut" },
      labels: ["Read", "Unread"],
      colors: ["#0ab39c", "#f06548"],
      legend: { show: false },
      dataLabels: { enabled: false },
      plotOptions: { pie: { donut: { size: "75%" } } },
    },
  };

  const activityChart = {
    series: [{ name: "Messages", data: [45, 52, 38, 65, 72, 58, 80] }],
    options: {
      chart: { type: "area", toolbar: { show: false } },
      stroke: { curve: "smooth", width: 2 },
      fill: { type: "gradient", gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
      colors: ["#405189"],
      xaxis: { categories: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
    },
  };

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Dashboard" pageTitle="Chat" />

        <Row className="mb-3 pb-1">
          <Col xs={12}>
            <div className="d-flex align-items-lg-center flex-lg-row flex-column">
              <div className="flex-grow-1">
                <h4 className="fs-16 mb-1">Welcome back, John!</h4>
                <p className="text-muted mb-0">Here's your communication overview.</p>
              </div>
              <div className="mt-3 mt-lg-0 d-flex gap-2">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control border-0 dash-filter-picker shadow"
                    readOnly
                    defaultValue="20 Aug 2025, Wednesday"
                  />
                  <div className="input-group-text bg-primary border-primary text-white">
                    <i className="ri-calendar-2-line"></i>
                  </div>
                </div>
                <Link to="/communication/compose" className="btn btn-primary">
                  <i className="ri-send-plane-line align-middle me-1"></i> Compose Message
                </Link>
              </div>
            </div>
          </Col>
        </Row>

        <Row>
          {dashboardStats.map((stat) => {
            const theme = statTheme[stat.label] || { bgcolor: "primary", icon: "ri-bar-chart-line" };
            const numeric = typeof stat.value === "number";
            return (
              <Col xl={2} md={4} sm={6} key={stat.label}>
                <Card className="card-animate">
                  <CardBody>
                    <div className="d-flex align-items-center">
                      <div className="flex-grow-1 overflow-hidden">
                        <p className="text-uppercase fw-medium text-muted text-truncate mb-0">
                          {stat.label}
                        </p>
                      </div>
                    </div>
                    <div className="d-flex align-items-end justify-content-between mt-4">
                      <div>
                        <h4 className="fs-22 fw-semibold ff-secondary mb-2">
                          {numeric ? (
                            <CountUp start={0} end={stat.value} duration={2} />
                          ) : (
                            stat.value
                          )}
                        </h4>
                        {stat.trend && (
                          <span className="badge bg-light text-muted mb-0">{stat.trend}</span>
                        )}
                      </div>
                      <div className="avatar-sm flex-shrink-0">
                        <span className={`avatar-title rounded fs-3 bg-${theme.bgcolor}-subtle`}>
                          <i className={`text-${theme.bgcolor} ${theme.icon}`}></i>
                        </span>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </Col>
            );
          })}
        </Row>

        <Row className="mt-3">
          <Col xl={4} md={6}>
            <Card>
              <CardHeader className="align-items-center d-flex">
                <h4 className="card-title mb-0 flex-grow-1">Recent Messages</h4>
                <Link to="/communication/inbox" className="btn btn-soft-primary btn-sm">
                  View All
                </Link>
              </CardHeader>
              <CardBody>
                <div className="vstack gap-3">
                  {inboxMessages.slice(0, 5).map((msg) => (
                    <div key={msg.id} className="d-flex align-items-center">
                      <CommAvatar id={msg.id} />
                      <div className="flex-grow-1 ms-3 overflow-hidden">
                        <div className="d-flex justify-content-between">
                          <p className="text-truncate fs-13 mb-0 fw-medium">{msg.sender}</p>
                          <small className="text-muted">{msg.time}</small>
                        </div>
                        <p className="text-muted text-truncate fs-12 mb-0">{msg.preview}</p>
                      </div>
                      {msg.unread > 0 && (
                        <span className="badge bg-danger-subtle text-danger ms-2">{msg.unread}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </Col>

          <Col xl={4} md={6}>
            <Card>
              <CardHeader className="align-items-center d-flex">
                <h4 className="card-title mb-0 flex-grow-1">Recent Sent Messages</h4>
                <Link to="/communication/sent" className="btn btn-soft-primary btn-sm">
                  View All
                </Link>
              </CardHeader>
              <CardBody>
                <div className="vstack gap-3">
                  {sentMessages.slice(0, 4).map((msg) => (
                    <div key={msg.id} className="d-flex align-items-center">
                      <CommAvatar id={msg.id} />
                      <div className="flex-grow-1 ms-3 overflow-hidden">
                        <div className="d-flex justify-content-between">
                          <p className="text-truncate fs-13 mb-0 fw-medium">{msg.to}</p>
                          <small className="text-muted">{msg.time}</small>
                        </div>
                        <p className="text-muted text-truncate fs-12 mb-0">{msg.subject}</p>
                      </div>
                      <i className="ri-check-double-line text-success ms-2"></i>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </Col>

          <Col xl={4}>
            <Card>
              <CardHeader>
                <h4 className="card-title mb-0">Department-wise Message Summary</h4>
              </CardHeader>
              <CardBody>
                <ReactApexChart
                  options={deptChart.options}
                  series={deptChart.series}
                  type="donut"
                  height={280}
                />
              </CardBody>
            </Card>
          </Col>
        </Row>

        <Row className="mt-3">
          <Col xl={4} md={6}>
            <Card>
              <CardHeader className="align-items-center d-flex">
                <h4 className="card-title mb-0 flex-grow-1">Recent Announcements</h4>
                <Link to="/communication/announcements" className="btn btn-soft-primary btn-sm">
                  View All
                </Link>
              </CardHeader>
              <CardBody>
                <div className="vstack gap-3">
                  {announcements.slice(0, 3).map((a) => (
                    <div key={a.id} className="d-flex">
                      <div className="flex-shrink-0">
                        <span className="avatar-title bg-primary-subtle text-primary rounded fs-4">
                          <i className={a.icon || "ri-megaphone-line"}></i>
                        </span>
                      </div>
                      <div className="flex-grow-1 ms-3">
                        <h6 className="fs-14 mb-1">{a.title}</h6>
                        <p className="text-muted fs-12 mb-1">
                          {a.author || a.category} · {a.date}
                        </p>
                        <span
                          className={`badge bg-${a.status === "Active" ? "success" : "warning"}-subtle text-${a.status === "Active" ? "success" : "warning"}`}
                        >
                          {a.status || "Important"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </Col>

          <Col xl={4} md={6}>
            <Card>
              <CardHeader>
                <h4 className="card-title mb-0">Read vs Unread</h4>
              </CardHeader>
              <CardBody>
                <ReactApexChart
                  options={readChart.options}
                  series={readChart.series}
                  type="donut"
                  height={220}
                />
                <Row className="text-center mt-2">
                  <Col>
                    <h5 className="mb-1 text-success">198</h5>
                    <p className="text-muted fs-12 mb-0">Read (63%)</p>
                  </Col>
                  <Col>
                    <h5 className="mb-1 text-danger">114</h5>
                    <p className="text-muted fs-12 mb-0">Unread (37%)</p>
                  </Col>
                </Row>
              </CardBody>
            </Card>
          </Col>

          <Col xl={4}>
            <Card>
              <CardHeader>
                <h4 className="card-title mb-0">Communication Analytics (This Week)</h4>
              </CardHeader>
              <CardBody>
                <ReactApexChart
                  options={activityChart.options}
                  series={activityChart.series}
                  type="area"
                  height={200}
                />
                <Row className="text-center mt-3 g-2">
                  <Col xs={3}>
                    <h6 className="mb-0">126</h6>
                    <small className="text-muted">Sent</small>
                  </Col>
                  <Col xs={3}>
                    <h6 className="mb-0">184</h6>
                    <small className="text-muted">Received</small>
                  </Col>
                  <Col xs={3}>
                    <h6 className="mb-0">98</h6>
                    <small className="text-muted">Replies</small>
                  </Col>
                  <Col xs={3}>
                    <h6 className="mb-0">2h 15m</h6>
                    <small className="text-muted">Avg Response</small>
                  </Col>
                </Row>
              </CardBody>
            </Card>
          </Col>
        </Row>

        <Row className="mt-3">
          <Col xl={4}>
            <Card className="card-height-100">
              <CardHeader>
                <h4 className="card-title mb-0">My Profile</h4>
              </CardHeader>
              <CardBody className="text-center">
                <CommAvatar id={1} size="lg" className="mx-auto mb-3" />
                <h5 className="mb-1">{currentUser.name}</h5>
                <p className="text-muted mb-1">{currentUser.role}</p>
                <p className="text-muted fs-12">{currentUser.email}</p>
                <select className="form-select form-select-sm mt-3">
                  <option>🟢 Online</option>
                  <option>🟡 Away</option>
                  <option>🔴 Busy</option>
                  <option>⚫ Offline</option>
                </select>
              </CardBody>
            </Card>
          </Col>
          <Col xl={8}>
            <Card className="card-height-100">
              <CardHeader className="align-items-center d-flex">
                <h4 className="card-title mb-0 flex-grow-1">Favorite Contacts</h4>
                <Link to="#" className="btn btn-soft-primary btn-sm">
                  View all
                </Link>
              </CardHeader>
              <CardBody>
                <Row>
                  {favoriteContacts.map((c, i) => (
                    <Col md={6} key={c.name}>
                      <div className="d-flex align-items-center mb-3">
                        <CommAvatar id={i + 2} />
                        <div className="flex-grow-1 ms-3">
                          <h6 className="fs-14 mb-0">{c.name}</h6>
                          <span
                            className={`badge bg-${c.status === "online" ? "success" : c.status === "away" ? "warning" : "secondary"}-subtle text-${c.status === "online" ? "success" : c.status === "away" ? "warning" : "secondary"} fs-10`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <button className="btn btn-soft-primary btn-sm btn-icon">
                          <i className="ri-star-fill"></i>
                        </button>
                      </div>
                    </Col>
                  ))}
                </Row>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Dashboard;
