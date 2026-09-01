import React from "react";
import { Card, CardBody, CardHeader, Col, Container, Row } from "reactstrap";
import ReactApexChart from "react-apexcharts";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import CommAvatar from "../components/CommAvatar";
import { managementStats } from "../data/staticData";

const ManagementDashboard = () => {
  document.title = "Management Dashboard | Chat Module | SoftOnCloud";

  const responseChart = {
    series: [42, 28, 18, 12],
    options: {
      chart: { type: "donut" },
      labels: ["Quick", "Good", "Average", "Slow"],
      colors: ["#0ab39c", "#405189", "#f7b84b", "#f06548"],
      legend: { position: "bottom", fontSize: "11px" },
      plotOptions: { pie: { donut: { size: "65%", labels: { show: true, total: { show: true, label: "Total", formatter: () => "312 Messages" } } } } },
    },
  };

  const activityChart = {
    series: [{ name: "Activity", data: [30, 45, 35, 50, 65, 55, 70, 60, 75, 80, 65, 90] }],
    options: {
      chart: { type: "area", toolbar: { show: false } },
      stroke: { curve: "smooth", width: 2 },
      fill: { type: "gradient", gradient: { opacityFrom: 0.3, opacityTo: 0.05 } },
      colors: ["#405189"],
      xaxis: { categories: ["8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM", "6PM", "7PM"] },
    },
  };

  const deptBarChart = {
    series: [{ data: [3.2, 5.8, 4.1, 6.2, 4.8, 5.5] }],
    options: {
      chart: { type: "bar", toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      colors: ["#405189"],
      xaxis: { categories: ["Sales", "IT", "HR", "Finance", "Marketing", "Operations"] },
    },
  };

  const responders = [
    { rank: 1, name: "Emily Davis", role: "Sales Executive", time: "1m 12s", rating: "Excellent", score: 98 },
    { rank: 2, name: "Michael Smith", role: "Sales Executive", time: "2m 05s", rating: "Excellent", score: 95 },
    { rank: 3, name: "Sarah Johnson", role: "Sales Executive", time: "3m 18s", rating: "Good", score: 88 },
    { rank: 4, name: "David Brown", role: "Sales Manager", time: "5m 42s", rating: "Average", score: 72 },
    { rank: 5, name: "Lisa Parker", role: "HR Manager", time: "12m 30s", rating: "Slow", score: 45 },
  ];

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Management Dashboard" pageTitle="Chat" />

        <Row className="mb-3 pb-1">
          <Col xs={12}>
            <div className="d-flex align-items-lg-center flex-lg-row flex-column">
              <div className="flex-grow-1">
                <h4 className="fs-16 mb-1">Management Dashboard</h4>
                <p className="text-muted mb-0">Real-time communication analytics and team performance insights.</p>
              </div>
              <div className="mt-3 mt-lg-0 d-flex gap-2">
                <div className="input-group">
                  <input type="text" className="form-control border-0 dash-filter-picker shadow" readOnly defaultValue="20 Aug 2025 - 20 Aug 2025" />
                  <div className="input-group-text bg-primary border-primary text-white"><i className="ri-calendar-2-line"></i></div>
                </div>
                <button className="btn btn-soft-secondary btn-sm">Filters</button>
                <button className="btn btn-primary btn-sm">Export</button>
              </div>
            </div>
          </Col>
        </Row>

        <Row>
          {managementStats.map((stat) => (
            <Col xl={2} md={4} sm={6} key={stat.label}>
              <Card className="card-animate">
                <CardBody>
                  <p className="text-uppercase fw-medium text-muted text-truncate mb-3">{stat.label}</p>
                  <h4 className="fs-22 fw-semibold ff-secondary mb-2">{stat.value}</h4>
                  <span className={`badge bg-light text-${stat.trend.startsWith("-") ? "danger" : "success"}`}>{stat.trend}</span>
                </CardBody>
              </Card>
            </Col>
          ))}
        </Row>

        <Row className="mt-3">
          <Col xl={5}>
            <Card>
              <CardHeader><h4 className="card-title mb-0">Top Quick Responders</h4></CardHeader>
              <CardBody>
                <div className="table-responsive">
                  <table className="table table-sm table-borderless align-middle mb-0">
                    <thead className="text-muted fs-12">
                      <tr><th>#</th><th>Employee</th><th>Avg Response</th><th>Rating</th><th>Score</th></tr>
                    </thead>
                    <tbody>
                      {responders.map((r) => (
                        <tr key={r.rank}>
                          <td>{r.rank}</td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <CommAvatar id={r.rank} size="xs" />
                              <div>
                                <div className="fs-13 fw-medium">{r.name}</div>
                                <div className="text-muted fs-11">{r.role}</div>
                              </div>
                            </div>
                          </td>
                          <td className="fs-12">{r.time}</td>
                          <td>
                            <span className={`badge bg-${r.rating === "Excellent" ? "success" : r.rating === "Slow" ? "danger" : r.rating === "Good" ? "primary" : "warning"}-subtle text-${r.rating === "Excellent" ? "success" : r.rating === "Slow" ? "danger" : r.rating === "Good" ? "primary" : "warning"}`}>
                              {r.rating}
                            </span>
                          </td>
                          <td className="fw-medium">{r.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </Col>
          <Col xl={4}>
            <Card>
              <CardHeader><h4 className="card-title mb-0">Avg Reply Time by Department</h4></CardHeader>
              <CardBody>
                <ReactApexChart options={deptBarChart.options} series={deptBarChart.series} type="bar" height={280} />
              </CardBody>
            </Card>
          </Col>
          <Col xl={3}>
            <Card>
              <CardHeader><h4 className="card-title mb-0">Response Performance</h4></CardHeader>
              <CardBody>
                <ReactApexChart options={responseChart.options} series={responseChart.series} type="donut" height={280} />
              </CardBody>
            </Card>
          </Col>
        </Row>

        <Row className="mt-3">
          <Col xl={8}>
            <Card>
              <CardHeader><h4 className="card-title mb-0">Online Activity Trend</h4></CardHeader>
              <CardBody>
                <ReactApexChart options={activityChart.options} series={activityChart.series} type="area" height={300} />
              </CardBody>
            </Card>
          </Col>
          <Col xl={4}>
            <Card className="card-height-100">
              <CardHeader><h4 className="card-title mb-0">AI Insights</h4></CardHeader>
              <CardBody>
                {[
                  "Sales team response time improved by 12% this week",
                  "3 employees have pending replies over 24 hours",
                  "Announcement read rate is highest on Tuesdays",
                  "Group chat activity peaks between 10-11 AM",
                ].map((insight, i) => (
                  <div key={i} className="d-flex gap-2 mb-3">
                    <i className="ri-lightbulb-flash-line text-warning mt-1"></i>
                    <span className="fs-13 text-muted">{insight}</span>
                  </div>
                ))}
                <button className="btn btn-primary btn-sm w-100">Generate Full AI Report</button>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default ManagementDashboard;
