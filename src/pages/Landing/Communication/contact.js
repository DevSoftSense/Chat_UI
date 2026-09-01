import React from "react";
import { Col, Container, Form, Row } from "reactstrap";

const Contact = () => (
  <section className="section bg-light" id="contact">
    <Container>
      <Row className="justify-content-center">
        <Col lg={8}>
          <div className="text-center mb-5">
            <h3 className="mb-3 fw-semibold">Get In Touch</h3>
            <p className="text-muted mb-4 ff-secondary">
              Tell us about your team and how SoftOnCloud can streamline your communication.
            </p>
          </div>
        </Col>
      </Row>
      <Row className="gy-4">
        <Col lg={4}>
          <h5 className="fs-13 text-muted text-uppercase">Office Address</h5>
          <div className="ff-secondary fw-semibold mb-4">
            909, Icon Business Center<br />Dumas Road<br />Surat - 395007
          </div>
          <h5 className="fs-13 text-muted text-uppercase">Working Hours</h5>
          <div className="ff-secondary fw-semibold">10:00 AM to 7:00 PM</div>
        </Col>
        <Col lg={8}>
          <Form onSubmit={(e) => e.preventDefault()}>
            <Row>
              <Col lg={6}><div className="mb-4"><label className="form-label fs-13">Name</label><input className="form-control bg-white" placeholder="Your name*" /></div></Col>
              <Col lg={6}><div className="mb-4"><label className="form-label fs-13">Email</label><input type="email" className="form-control bg-white" placeholder="Your email*" /></div></Col>
            </Row>
            <Row>
              <Col lg={12}><div className="mb-4"><label className="form-label fs-13">Subject</label><input className="form-control bg-white" placeholder="Your subject" /></div></Col>
            </Row>
            <Row>
              <Col lg={12}><div className="mb-3"><label className="form-label fs-13">Message</label><textarea rows="3" className="form-control bg-white" placeholder="Your message..."></textarea></div></Col>
            </Row>
            <Row><Col lg={12} className="text-end"><button type="submit" className="btn btn-primary">Send Message</button></Col></Row>
          </Form>
        </Col>
      </Row>
    </Container>
  </section>
);

export default Contact;
