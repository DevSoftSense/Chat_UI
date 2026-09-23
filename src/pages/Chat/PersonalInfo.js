import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Offcanvas,
  OffcanvasBody,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  UncontrolledDropdown,
  Input,
  Label,
} from "reactstrap";
import Img9 from "../../assets/images/small/img-9.jpg";
import dummyImage from "../../assets/images/users/user-dummy-img.jpg";
import { normalizeProfilePhoneFields } from "../../helpers/softoncloud_auth_helper";

const displayField = (value) => {
  const text = String(value ?? "").trim();
  if (!text || text === "—") return "—";
  return text;
};

const ATTACHED_FILES_PAGE_SIZE = 4;

const Attachements = ({ attachement, onDownload, downloading = false }) => {
  const handleDownload = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof onDownload === "function") {
      onDownload(attachement);
    }
  };

  return (
    <div className="border rounded border-dashed p-2">
      <div className="d-flex align-items-center">
        <div className="flex-shrink-0 me-3">
          <div className="avatar-xs">
            <div className="avatar-title bg-light text-secondary rounded fs-20">
              <i className={attachement.foldericon}></i>
            </div>
          </div>
        </div>
        <div className="flex-grow-1 overflow-hidden">
          <h5 className="fs-13 mb-1">
            <Link
              to="#"
              className="text-body text-truncate d-block"
              onClick={handleDownload}
              title={attachement.foldername}
            >
              {attachement.foldername}
            </Link>
          </h5>
          {attachement.foldersize ? (
            <div className="text-muted">{attachement.foldersize}</div>
          ) : null}
        </div>
        <div className="flex-shrink-0 ms-2">
          <div className="d-flex gap-1">
            <button
              type="button"
              className="btn btn-icon text-muted btn-sm fs-18"
              onClick={handleDownload}
              disabled={downloading}
              title="Download"
            >
              <i
                className={
                  downloading ? "ri-loader-4-line" : "ri-download-2-line"
                }
              ></i>
            </button>
            <UncontrolledDropdown>
              <DropdownToggle
                tag="button"
                className="btn btn-icon text-muted btn-sm fs-18 dropdown"
              >
                <i className="ri-more-fill"></i>
              </DropdownToggle>
              <DropdownMenu>
                <DropdownItem onClick={handleDownload}>
                  <i className="ri-download-2-line align-bottom me-2 text-muted"></i>{" "}
                  Download
                </DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>
          </div>
        </div>
      </div>
    </div>
  );
};

const PersonalInfo = ({
  show,
  onCloseClick,
  currentuser,
  cuurentiseImg,
  phone,
  email,
  location,
  statusLabel,
  isSelf = false,
  onAvatarChange,
  onProfileSave,
  avatarSaving = false,
  profileLoading = false,
  jobTitle = "",
  department = "",
  realName = "",
  attachedFiles = [],
  onDownloadAttachment,
  downloadingAttachmentIds,
  starredMessages = [],
  onOpenStarredMessage,
  onUnstarMessage,
}) => {
  const [menu1, setMenu1] = useState(false);
  const [menu2, setMenu2] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ATTACHED_FILES_PAGE_SIZE);
  const [starredVisibleCount, setStarredVisibleCount] = useState(
    ATTACHED_FILES_PAGE_SIZE
  );
  const [showStarredSection, setShowStarredSection] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editName, setEditName] = useState("");
  const [editJob, setEditJob] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const fileInputRef = useRef(null);
  const starredSectionRef = useRef(null);

  const files = Array.isArray(attachedFiles) ? attachedFiles : [];
  const visibleFiles = files.slice(0, visibleCount);
  const hasMoreFiles = files.length > visibleCount;

  const starred = Array.isArray(starredMessages) ? starredMessages : [];
  const visibleStarred = starred.slice(0, starredVisibleCount);
  const hasMoreStarred = starred.length > starredVisibleCount;

  useEffect(() => {
    setVisibleCount(ATTACHED_FILES_PAGE_SIZE);
    setStarredVisibleCount(ATTACHED_FILES_PAGE_SIZE);
    setShowStarredSection(false);
    setEditing(false);
  }, [show, currentuser]);

  useEffect(() => {
    setVisibleCount(ATTACHED_FILES_PAGE_SIZE);
  }, [files.length]);

  useEffect(() => {
    setStarredVisibleCount(ATTACHED_FILES_PAGE_SIZE);
  }, [starred.length]);

  useEffect(() => {
    if (!editing) return;
    const nationalPhone = normalizeProfilePhoneFields(
      displayField(phone) === "—" ? "" : String(phone || "")
    ).phone;
    setEditPhone(nationalPhone);
    setEditEmail(displayField(email) === "—" ? "" : String(email || ""));
    setEditLocation(
      displayField(location) === "—" ? "" : String(location || "")
    );
    setEditName(String(realName || (currentuser !== "You" ? currentuser : "") || ""));
    setEditJob(String(jobTitle || ""));
    setEditDepartment(
      displayField(department) === "—" ? "" : String(department || "")
    );
  }, [editing, phone, email, location, currentuser, realName, jobTitle, department]);

  const toggleStarredSection = () => {
    setShowStarredSection((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => {
          starredSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 50);
      }
      return next;
    });
  };

  const handleAvatarFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !isSelf || typeof onAvatarChange !== "function") return;
    if (!file.type.startsWith("image/")) return;
    onAvatarChange(file);
  };

  const startEdit = () => {
    if (!isSelf || typeof onProfileSave !== "function") return;
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (typeof onProfileSave !== "function") return;
    setSavingProfile(true);
    try {
      // SoftOnCloud UpdateUserProfileRequest — no email/location (additionalProperties: false)
      await onProfileSave({
        displayName: editName.trim() || undefined,
        phone: normalizeProfilePhoneFields(editPhone.trim()).phone,
        jobTitle: editJob.trim(),
        department: editDepartment.trim(),
      });
      setEditing(false);
    } catch {
      // Parent shows toast; keep form open with entered values
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <Offcanvas
      isOpen={show}
      direction="end"
      className="offcanvas-end border-0"
      toggle={onCloseClick}
    >
      <OffcanvasBody className="offcanvas-body profile-offcanvas p-0">
        <div className="team-cover">
          <img src={Img9} alt="" className="img-fluid" />
        </div>
        <div className="p-1 pb-4 pt-0">
          <div className="team-settings">
            <div className="row g-0">
              <div className="col">
                <div className="btn nav-btn">
                  <Button
                    onClick={onCloseClick}
                    color=""
                    className="btn-close btn-close-white"
                  ></Button>
                </div>
              </div>
              <div className="col-auto">
                <div className="user-chat-nav d-flex">
                  <button
                    type="button"
                    className={`btn nav-btn favourite-btn ${
                      showStarredSection ? "active" : ""
                    }`}
                    title={
                      showStarredSection
                        ? "Hide starred messages"
                        : "Show starred messages"
                    }
                    onClick={toggleStarredSection}
                  >
                    <i
                      className={
                        showStarredSection ? "ri-star-fill" : "ri-star-line"
                      }
                    ></i>
                  </button>

                  <Dropdown isOpen={menu1} toggle={() => setMenu1(!menu1)}>
                    <DropdownToggle className="btn nav-btn" tag="a">
                      <i className="ri-more-2-fill"></i>
                    </DropdownToggle>
                    <DropdownMenu className="dropdown-menu-end">
                      <DropdownItem href="#">
                        <i className="ri-inbox-archive-line align-bottom text-muted me-2"></i>
                        Archive
                      </DropdownItem>
                      <DropdownItem href="#">
                        <i className="ri-mic-off-line align-bottom text-muted me-2"></i>
                        Muted
                      </DropdownItem>
                      <DropdownItem href="#">
                        <i className="ri-delete-bin-5-line align-bottom text-muted me-2"></i>
                        Delete
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-3 text-center">
          <div className="profile-user position-relative d-inline-block mx-auto mb-2">
            {cuurentiseImg ? (
              <img
                src={cuurentiseImg}
                alt=""
                className="avatar-lg img-thumbnail rounded-circle mx-auto profile-img user-profile-image"
              />
            ) : (
              <img
                src={dummyImage}
                alt=""
                className="avatar-lg img-thumbnail rounded-circle mx-auto profile-img user-profile-image"
              />
            )}
            {isSelf ? (
              <div className="avatar-xs p-0 rounded-circle profile-photo-edit">
                <Input
                  id="chat-profile-img-file-input"
                  type="file"
                  className="profile-img-file-input"
                  accept="image/*"
                  innerRef={fileInputRef}
                  disabled={avatarSaving}
                  onChange={handleAvatarFile}
                />
                <Label
                  htmlFor="chat-profile-img-file-input"
                  className="profile-photo-edit avatar-xs"
                  title="Edit Profile Picture"
                >
                  <span className="avatar-title rounded-circle bg-light text-body">
                    <i className="ri-camera-fill"></i>
                  </span>
                </Label>
              </div>
            ) : null}
          </div>
          <div className="mt-3">
            <h5 className="fs-16 mb-1">
              <Link to="#" className="link-primary username">
                {currentuser}
              </Link>
            </h5>
            <p className="text-muted">
              <i
                className={`ri-checkbox-blank-circle-fill me-1 align-bottom ${
                  statusLabel === "Online" ? "text-success" : "text-muted"
                }`}
              ></i>
              {statusLabel || "Offline"}
            </p>
          </div>
          <div className="d-flex gap-2 justify-content-center">
            <button
              type="button"
              className="btn avatar-xs p-0"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="Message"
            >
              <span className="avatar-title rounded bg-light text-body">
                <i className="ri-question-answer-line"></i>
              </span>
            </button>

            <button
              type="button"
              className="btn avatar-xs p-0"
              title={
                showStarredSection
                  ? "Hide starred messages"
                  : "Show starred messages"
              }
              onClick={toggleStarredSection}
            >
              <span className="avatar-title rounded bg-light text-body">
                <i
                  className={
                    showStarredSection
                      ? "ri-star-fill text-warning"
                      : "ri-star-line"
                  }
                ></i>
              </span>
            </button>

            <button
              type="button"
              className="btn avatar-xs p-0"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="Phone"
            >
              <span className="avatar-title rounded bg-light text-body">
                <i className="ri-phone-line"></i>
              </span>
            </button>

            <Dropdown isOpen={menu2} toggle={() => setMenu2(!menu2)}>
              <DropdownToggle className="btn avatar-xs p-0" tag="a">
                <span className="avatar-title bg-light text-body rounded">
                  <i className="ri-more-fill"></i>
                </span>
              </DropdownToggle>
              <DropdownMenu className="dropdown-menu-end">
                <DropdownItem href="#">
                  <i className="ri-inbox-archive-line align-bottom text-muted me-2"></i>
                  Archive
                </DropdownItem>
                <DropdownItem href="#">
                  <i className="ri-mic-off-line align-bottom text-muted me-2"></i>
                  Muted
                </DropdownItem>
                <DropdownItem href="#">
                  <i className="ri-delete-bin-5-line align-bottom text-muted me-2"></i>
                  Delete
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
        <div className="border-top border-top-dashed p-3">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h5 className="fs-15 mb-0">Personal Details</h5>
            {isSelf && typeof onProfileSave === "function" ? (
              editing ? (
                <div className="d-flex gap-1">
                  <Button
                    color="light"
                    size="sm"
                    type="button"
                    disabled={savingProfile || profileLoading}
                    onClick={cancelEdit}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="success"
                    size="sm"
                    type="button"
                    disabled={savingProfile || profileLoading}
                    onClick={saveEdit}
                  >
                    {savingProfile ? "Saving..." : "Save"}
                  </Button>
                </div>
              ) : (
                <Button
                  color="soft-primary"
                  size="sm"
                  type="button"
                  disabled={profileLoading}
                  onClick={startEdit}
                >
                  <i className="ri-edit-line align-bottom me-1"></i>
                  Edit
                </Button>
              )
            ) : null}
          </div>

          {profileLoading && isSelf ? (
            <p className="text-muted mb-0 fs-13">Loading profile…</p>
          ) : editing ? (
            <>
              <div className="mb-3">
                <Label className="text-muted text-uppercase fw-medium fs-12 mb-1">
                  Name
                </Label>
                <Input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your display name"
                  disabled={savingProfile}
                />
              </div>
              <div className="mb-3">
                <Label className="text-muted text-uppercase fw-medium fs-12 mb-1">
                  Number
                </Label>
                <Input
                  type="text"
                  value={editPhone}
                  onChange={(e) =>
                    setEditPhone(e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 20))
                  }
                  placeholder="Phone number"
                  maxLength={20}
                  disabled={savingProfile}
                />
              </div>
              <div className="mb-3">
                <Label className="text-muted text-uppercase fw-medium fs-12 mb-1">
                  Email
                </Label>
                <Input
                  type="email"
                  value={editEmail}
                  readOnly
                  disabled
                  placeholder="Email"
                />
              </div>
              <div className="mb-3">
                <Label className="text-muted text-uppercase fw-medium fs-12 mb-1">
                  Job
                </Label>
                <Input
                  type="text"
                  value={editJob}
                  onChange={(e) => setEditJob(e.target.value)}
                  placeholder="Job title"
                  disabled={savingProfile}
                />
              </div>
              <div className="mb-3">
                <Label className="text-muted text-uppercase fw-medium fs-12 mb-1">
                  Department
                </Label>
                <Input
                  type="text"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  placeholder="Department"
                  disabled={savingProfile}
                />
              </div>
              <div>
                <Label className="text-muted text-uppercase fw-medium fs-12 mb-1">
                  Location
                </Label>
                <Input
                  type="text"
                  value={editLocation}
                  readOnly
                  disabled
                  placeholder="Location"
                />
              </div>
            </>
          ) : (
            <>
              <div className="mb-3">
                <p className="text-muted text-uppercase fw-medium fs-12 mb-1">
                  Name
                </p>
                <h6>
                  {displayField(
                    realName || (currentuser !== "You" ? currentuser : "")
                  )}
                </h6>
              </div>
              <div className="mb-3">
                <p className="text-muted text-uppercase fw-medium fs-12 mb-1">
                  Number
                </p>
                <h6>{displayField(phone)}</h6>
              </div>
              <div className="mb-3">
                <p className="text-muted text-uppercase fw-medium fs-12 mb-1">
                  Email
                </p>
                <h6>{displayField(email)}</h6>
              </div>
              <div className="mb-3">
                <p className="text-muted text-uppercase fw-medium fs-12 mb-1">
                  Job
                </p>
                <h6>{displayField(jobTitle)}</h6>
              </div>
              <div className="mb-3">
                <p className="text-muted text-uppercase fw-medium fs-12 mb-1">
                  Department
                </p>
                <h6>{displayField(department)}</h6>
              </div>
              <div>
                <p className="text-muted text-uppercase fw-medium fs-12 mb-1">
                  Location
                </p>
                <h6 className="mb-0">{displayField(location)}</h6>
              </div>
            </>
          )}
        </div>

        {showStarredSection ? (
          <div
            className="border-top border-top-dashed p-3"
            ref={starredSectionRef}
          >
            <h5 className="fs-15 mb-3">
              <i className="ri-star-fill text-warning me-1"></i>
              Starred Messages
              {starred.length ? (
                <span className="text-muted fs-12 fw-normal ms-1">
                  ({starred.length})
                </span>
              ) : null}
            </h5>

            <div className="vstack gap-2">
              {visibleStarred.length === 0 ? (
                <p className="text-muted mb-0 fs-13">
                  No starred messages with {currentuser || "this contact"} yet.
                </p>
              ) : (
                visibleStarred.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded border-dashed p-2"
                  >
                    <div className="d-flex align-items-center">
                      <div className="flex-shrink-0 me-3">
                        <div className="avatar-xs">
                          <div className="avatar-title bg-light text-warning rounded fs-18">
                            <i className="ri-star-fill"></i>
                          </div>
                        </div>
                      </div>
                      <div className="flex-grow-1 overflow-hidden">
                        <h5 className="fs-13 mb-1">
                          <Link
                            to="#"
                            className="text-body text-truncate d-block"
                            title={item.preview}
                            onClick={(e) => {
                              e.preventDefault();
                              if (typeof onOpenStarredMessage === "function") {
                                onOpenStarredMessage(item);
                              }
                            }}
                          >
                            {item.preview}
                          </Link>
                        </h5>
                        {item.time ? (
                          <div className="text-muted">{item.time}</div>
                        ) : null}
                      </div>
                      <div className="flex-shrink-0 ms-2">
                        <div className="d-flex gap-1">
                          <UncontrolledDropdown>
                            <DropdownToggle
                              tag="button"
                              className="btn btn-icon text-muted btn-sm fs-18 dropdown"
                            >
                              <i className="ri-more-fill"></i>
                            </DropdownToggle>
                            <DropdownMenu end>
                              <DropdownItem
                                onClick={() => {
                                  if (
                                    typeof onOpenStarredMessage === "function"
                                  ) {
                                    onOpenStarredMessage(item);
                                  }
                                }}
                              >
                                <i className="ri-eye-line align-bottom me-2 text-muted"></i>{" "}
                                Open
                              </DropdownItem>
                              <DropdownItem
                                onClick={() => {
                                  if (typeof onUnstarMessage === "function") {
                                    onUnstarMessage(item);
                                  }
                                }}
                              >
                                <i className="ri-star-off-line align-bottom me-2 text-muted"></i>{" "}
                                Unstar
                              </DropdownItem>
                            </DropdownMenu>
                          </UncontrolledDropdown>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {hasMoreStarred ? (
                <div className="text-center mt-2">
                  <button
                    type="button"
                    className="btn btn-soft-warning btn-sm"
                    onClick={() =>
                      setStarredVisibleCount(
                        (prev) => prev + ATTACHED_FILES_PAGE_SIZE
                      )
                    }
                  >
                    Load more
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="border-top border-top-dashed p-3">
          <h5 className="fs-15 mb-3">Attached Files</h5>

          <div className="vstack gap-2">
            {visibleFiles.length === 0 ? (
              <p className="text-muted mb-0 fs-13">
                No files shared in this chat yet.
              </p>
            ) : (
              visibleFiles.map((attachement) => {
                const downloadKey = String(
                  attachement.id || attachement.path || attachement.foldername
                );
                const downloading =
                  downloadingAttachmentIds instanceof Set
                    ? downloadingAttachmentIds.has(downloadKey) ||
                      downloadingAttachmentIds.has(String(attachement.path || ""))
                    : false;
                return (
                  <Attachements
                    key={downloadKey}
                    attachement={attachement}
                    onDownload={onDownloadAttachment}
                    downloading={downloading}
                  />
                );
              })
            )}

            {hasMoreFiles ? (
              <div className="text-center mt-2">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() =>
                    setVisibleCount((prev) => prev + ATTACHED_FILES_PAGE_SIZE)
                  }
                >
                  Load more{" "}
                  <i className="ri-arrow-right-fill align-bottom ms-1"></i>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </OffcanvasBody>
    </Offcanvas>
  );
};

export default PersonalInfo;
