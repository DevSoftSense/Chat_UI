import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
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
import { groups, groupMessages, contacts } from "../data/staticData";

const Groups = () => {
  document.title = "Groups | Chat Module | SoftOnCloud";
  const [activeGroup, setActiveGroup] = useState(groups[0]);
  const [activeTab, setActiveTab] = useState("1");

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Groups" pageTitle="Chat" />

        <div className="chat-wrapper d-lg-flex gap-1 mx-n4 mt-n4 p-1">
          <div className="chat-leftsidebar" style={{ minWidth: 320 }}>
            <div className="px-4 pt-4 mb-3">
              <h5 className="mb-3">Groups</h5>
              <div className="search-box">
                <Input type="text" className="bg-light border-light" placeholder="Search groups..." />
                <i className="ri-search-2-line search-icon"></i>
              </div>
            </div>
            <Nav tabs className="nav nav-tabs nav-tabs-custom nav-primary nav-justified mb-3 px-2">
              <NavItem>
                <NavLink className={classnames({ active: activeTab === "1" })} onClick={() => setActiveTab("1")} style={{ cursor: "pointer" }}>
                  All Groups
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink className={classnames({ active: activeTab === "2" })} onClick={() => setActiveTab("2")} style={{ cursor: "pointer" }}>
                  My Groups
                </NavLink>
              </NavItem>
            </Nav>
            <SimpleBar className="chat-room-list px-2">
              <ul className="list-unstyled chat-list chat-user-list mb-0">
                {groups.map((g) => (
                  <li key={g.id} className={classnames({ active: activeGroup.id === g.id })}>
                    <Link to="#" onClick={() => setActiveGroup(g)}>
                      <div className="d-flex align-items-center">
                        <div className="flex-shrink-0 chat-user-img align-self-center me-2 ms-0">
                          <div className="avatar-xs">
                            <span className="avatar-title rounded-circle bg-primary-subtle text-primary">
                              {g.initials}
                            </span>
                          </div>
                        </div>
                        <div className="flex-grow-1 overflow-hidden">
                          <p className="text-truncate mb-0 fw-medium">{g.name}</p>
                          <p className="text-truncate text-muted fs-12 mb-0">{g.preview}</p>
                        </div>
                        <div className="flex-shrink-0 text-end">
                          <small className="text-muted fs-10">{g.time}</small>
                          {g.unread > 0 && (
                            <span className="badge bg-success rounded-pill ms-1">{g.unread}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="text-center py-3">
                <Link to="#" className="text-primary fs-13">+ Create New Group</Link>
              </div>
            </SimpleBar>
          </div>

          <div className="user-chat w-100 overflow-hidden">
            <div className="chat-content d-lg-flex">
              <div className="w-100 overflow-hidden position-relative">
                <div className="position-relative">
                  <div className="p-3 user-chat-topbar border-bottom">
                    <Row className="align-items-center">
                      <Col sm={4}>
                        <div className="d-flex align-items-center">
                          <div className="avatar-xs me-3">
                            <span className="avatar-title rounded-circle bg-primary-subtle text-primary">
                              {activeGroup.initials}
                            </span>
                          </div>
                          <div>
                            <h5 className="mb-0 fs-16">{activeGroup.name}</h5>
                            <small className="text-muted">{activeGroup.members} Members</small>
                          </div>
                        </div>
                      </Col>
                      <Col sm={8} className="text-end">
                        <div className="hstack gap-2 justify-content-end">
                          {["ri-search-line", "ri-phone-line", "ri-vidicon-line"].map((icon) => (
                            <button key={icon} type="button" className="btn btn-ghost-secondary btn-icon btn-sm">
                              <i className={icon}></i>
                            </button>
                          ))}
                        </div>
                      </Col>
                    </Row>
                    <Nav tabs className="nav nav-tabs nav-tabs-custom nav-success mt-3">
                      {["Chat", "Files", "Tasks", "Members", "Settings"].map((tab, i) => (
                        <NavItem key={tab}>
                          <NavLink className={classnames({ active: i === 0 }, "fw-semibold")} href="#">{tab}</NavLink>
                        </NavItem>
                      ))}
                    </Nav>
                  </div>

                  <SimpleBar className="chat-conversation p-3 p-lg-4" style={{ height: "calc(100vh - 340px)" }}>
                    <div className="text-center text-muted fs-12 mb-3">14 Aug 2025</div>
                    <ul className="list-unstyled chat-conversation-list mb-0">
                      {groupMessages.map((msg) => (
                        <li key={msg.id} className={classnames("chat-list", msg.isMe ? "right" : "left")}>
                          <div className="conversation-list">
                            {!msg.isMe && (
                              <div className="chat-avatar">
                                <CommAvatar id={msg.id} size="xs" />
                              </div>
                            )}
                            <div className="user-chat-content">
                              {!msg.isMe && (
                                <div className="conversation-name fw-medium fs-12 mb-1">{msg.sender}</div>
                              )}
                              {msg.type === "file" ? (
                                <div className="border rounded p-2 d-inline-flex align-items-center gap-2">
                                  <span className="avatar-title bg-success-subtle text-success rounded">
                                    <i className="ri-file-excel-2-line"></i>
                                  </span>
                                  <div>
                                    <div className="fs-12 fw-medium">{msg.fileName}</div>
                                    <small className="text-muted">{msg.fileSize}</small>
                                  </div>
                                </div>
                              ) : (
                                <div className="ctext-wrap">
                                  <div className="ctext-wrap-content">
                                    <p className="mb-0 ctext-content">{msg.message}</p>
                                  </div>
                                </div>
                              )}
                              <div className="conversation-name fs-11 text-muted">
                                <small>{msg.time}</small>
                                {msg.isMe && <i className="ri-check-double-line text-success ms-1"></i>}
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </SimpleBar>

                  <div className="chat-input-section p-3 border-top">
                    <form>
                      <Row className="g-0 align-items-center">
                        <Col>
                          <Input type="text" className="form-control chat-input bg-light border-light" placeholder="Type a message..." />
                        </Col>
                        <Col xs="auto">
                          <div className="chat-input-links ms-2">
                            <Button color="success" className="chat-send">
                              <i className="ri-send-plane-2-fill"></i>
                            </Button>
                          </div>
                        </Col>
                      </Row>
                    </form>
                  </div>
                </div>
              </div>

              <div className="chat-detail-sidebar border-start" style={{ width: 280, minWidth: 280 }}>
                <SimpleBar style={{ height: "calc(100vh - 180px)" }}>
                  <div className="p-4 text-center border-bottom">
                    <div className="avatar-md mx-auto mb-3">
                      <span className="avatar-title rounded-circle bg-primary-subtle text-primary fs-4">
                        {activeGroup.initials}
                      </span>
                    </div>
                    <h5 className="mb-1">{activeGroup.name}</h5>
                    <p className="text-muted fs-12 mb-0">{activeGroup.members} Members</p>
                    <p className="text-muted fs-12 mt-2">All sales team members across all regions</p>
                  </div>
                  <div className="p-4">
                    <h6 className="fs-13 mb-3">Group Members</h6>
                    {contacts.slice(0, 5).map((c, i) => (
                      <div key={c.id} className="d-flex align-items-center gap-2 mb-2">
                        <CommAvatar id={c.id} size="xs" />
                        <div className="flex-grow-1">
                          <span className="fs-13">{c.name}</span>
                          <small className="text-muted d-block">{i === 0 ? "Admin" : c.role}</small>
                        </div>
                      </div>
                    ))}
                    <Link to="#" className="fs-12 text-primary">+ 13 more members</Link>
                  </div>
                </SimpleBar>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default Groups;
