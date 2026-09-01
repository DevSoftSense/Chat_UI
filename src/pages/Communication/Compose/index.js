import React from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Form,
  Input,
  Label,
  Row,
} from "reactstrap";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import CommAvatar from "../components/CommAvatar";
import { contacts, attachments } from "../data/staticData";

const Compose = () => {
  document.title = "Compose | Chat Module | SoftOnCloud";

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Compose Message" pageTitle="Chat" />

        <Row>
          <Col xl={8}>
            <Card>
              <CardHeader>
                <h4 className="card-title mb-0">New Message</h4>
              </CardHeader>
              <CardBody>
                <Form>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <Label className="form-label mb-0">To</Label>
                      <Link to="#" className="text-primary fs-13">Clear All</Link>
                    </div>
                    <div className="border rounded p-2">
                      {contacts.slice(0, 4).map((c) => (
                        <span
                          key={c.id}
                          className="badge bg-light text-body border me-1 mb-1 d-inline-flex align-items-center gap-1 py-2 px-2"
                        >
                          <CommAvatar id={c.id} size="xs" />
                          {c.name}
                          <button type="button" className="btn btn-link btn-sm p-0 text-muted">×</button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3">
                    <Label>Subject (Optional)</Label>
                    <Input type="text" defaultValue="Monthly Sales Update" />
                  </div>

                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <Label className="mb-0">Message</Label>
                      <Input type="select" bsSize="sm" style={{ width: 140 }}>
                        <option>Templates</option>
                      </Input>
                    </div>
                    <div className="border rounded">
                      <div className="bg-light border-bottom px-2 py-1 d-flex gap-1 flex-wrap">
                        {["ri-bold", "ri-italic", "ri-underline", "ri-list-unordered", "ri-link", "ri-emotion-line"].map((icon) => (
                          <button key={icon} type="button" className="btn btn-sm btn-ghost-secondary">
                            <i className={icon}></i>
                          </button>
                        ))}
                      </div>
                      <Input
                        type="textarea"
                        rows="8"
                        className="border-0"
                        defaultValue={`Hello Team,

Please find the monthly sales update report attached. Kindly review the details and share your feedback.

Regards,
John Doe`}
                      />
                    </div>
                    <div className="text-end text-muted fs-12 mt-1">156/2000</div>
                  </div>

                  <div className="mb-4">
                    <Label>Attachments (2)</Label>
                    <div className="vstack gap-2 mb-2">
                      {attachments.map((f) => (
                        <div key={f.name} className="border rounded p-3 d-flex align-items-center gap-3">
                          <span className={`avatar-title bg-${f.type === "excel" ? "success" : "danger"}-subtle text-${f.type === "excel" ? "success" : "danger"} rounded fs-4`}>
                            <i className={f.type === "excel" ? "ri-file-excel-2-line" : "ri-file-pdf-line"}></i>
                          </span>
                          <div className="flex-grow-1">
                            <h6 className="fs-13 mb-0">{f.name}</h6>
                            <small className="text-muted">{f.size}</small>
                          </div>
                          <button type="button" className="btn btn-sm btn-ghost-danger">×</button>
                        </div>
                      ))}
                    </div>
                    <Button color="soft-secondary" size="sm">
                      <i className="ri-attachment-2 me-1"></i> Add Attachment
                    </Button>
                    <small className="text-muted ms-2">Max size 25 MB</small>
                  </div>

                  <Row className="g-3 mb-4">
                    <Col md={4}>
                      <Label>Message Type</Label>
                      <Input type="select" bsSize="sm"><option>Information</option></Input>
                    </Col>
                    <Col md={4}>
                      <Label>Priority</Label>
                      <Input type="select" bsSize="sm"><option>Normal</option></Input>
                    </Col>
                    <Col md={4}>
                      <div className="form-check form-switch mt-4">
                        <Input type="checkbox" role="switch" id="readReceipt" defaultChecked />
                        <Label check htmlFor="readReceipt">Request Read Receipt</Label>
                      </div>
                      <div className="form-check form-switch">
                        <Input type="checkbox" role="switch" id="pinMsg" />
                        <Label check htmlFor="pinMsg">Pin for Recipients</Label>
                      </div>
                    </Col>
                  </Row>

                  <div className="d-flex justify-content-between">
                    <Button color="soft-secondary">
                      <i className="ri-draft-line me-1"></i> Save Draft
                    </Button>
                    <Button color="primary">
                      <i className="ri-send-plane-fill me-1"></i> Send Message
                    </Button>
                  </div>
                </Form>
              </CardBody>
            </Card>
          </Col>

          <Col xl={4}>
            <Card>
              <CardHeader>
                <h4 className="card-title mb-0">Recipients (4)</h4>
              </CardHeader>
              <CardBody>
                {contacts.slice(0, 4).map((c) => (
                  <div key={c.id} className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
                    <CommAvatar id={c.id} />
                    <div className="flex-grow-1">
                      <h6 className="fs-13 mb-0">{c.name}</h6>
                      <small className="text-muted">{c.role}</small>
                    </div>
                    <span className={`badge bg-${c.status === "online" ? "success" : "warning"}-subtle text-${c.status === "online" ? "success" : "warning"} fs-10`}>
                      {c.status}
                    </span>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h4 className="card-title mb-0">Add Recipients</h4>
              </CardHeader>
              <CardBody>
                <Input type="text" placeholder="Search users or groups..." className="mb-3" bsSize="sm" />
                <div className="d-grid gap-2">
                  {["My Team", "By Department", "By Designation", "Select Group"].map((btn) => (
                    <Button key={btn} color="soft-secondary" size="sm">{btn}</Button>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card className="bg-primary-subtle border-0">
              <CardBody>
                <p className="text-primary mb-0 fs-13">
                  <i className="ri-lightbulb-line me-1"></i>
                  You can send the same message to multiple recipients as separate messages.
                </p>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Compose;
