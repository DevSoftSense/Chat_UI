import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
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
  Spinner,
} from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import {
  formatProfileApiError,
  formatProfilePhoneDisplay,
  getAuthSession,
  getProfileFromSession,
  getSessionUserIdentity,
  getSoftOnCloudProfile,
  resolveUserAvatarUrl,
  updateSoftOnCloudProfile,
  updateSoftOnCloudProfileImage,
} from "../../helpers/softoncloud_auth_helper";

const pickRaw = (raw, ...keys) => {
  if (!raw || typeof raw !== "object") return "";
  for (const key of keys) {
    const value = raw[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
};

const getInitials = (name, email) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (parts.length === 1) return parts[0][0].toUpperCase();
  const mail = String(email || "").trim();
  return mail ? mail.slice(0, 2).toUpperCase() : "U";
};

const formatLastLogin = (session) => {
  const raw =
    session?.lastLogin ||
    session?.lastLoginAt ||
    session?.last_login ||
    session?.last_login_at ||
    session?.user?.lastLogin ||
    session?.user?.lastLoginAt ||
    null;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw);
  const day = String(date.getDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sept",
    "Oct",
    "Nov",
    "Dec",
  ];
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${day}-${months[date.getMonth()]}-${date.getFullYear()} ${hh}:${mm}`;
};

const emptyForm = () => ({
  username: "",
  email: "",
  company: "",
  role: "",
  country: "",
  state: "",
  mobile: "",
  bio: "",
  skills: "",
  linkedin: "",
  github: "",
});

const UserProfile = () => {
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastLoginLabel, setLastLoginLabel] = useState(null);
  const [statusLabel, setStatusLabel] = useState("Active");

  const applyProfile = useCallback((profile) => {
    const session = getAuthSession() || {};
    const me = getSessionUserIdentity();
    const raw = profile?.raw || {};
    const displayName =
      profile?.displayName || me.displayName || "";
    const email = profile?.email || me.email || "";
    const phone = formatProfilePhoneDisplay(
      profile?.phoneCountryCode || me.phoneCountryCode,
      profile?.phone || me.phone
    );
    const location = profile?.location || me.location || "";
    const locationParts = String(location)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const company =
      pickRaw(raw, "company", "Company", "companyName", "organisationName", "organizationName") ||
      session?.productContext?.productName ||
      session?.productConnection?.productName ||
      "SoftOnCloud";

    const role =
      profile?.jobTitle ||
      me.jobTitle ||
      me.role ||
      pickRaw(raw, "role", "Role", "job_title") ||
      "Employee";

    setForm({
      username: displayName,
      email,
      company,
      role,
      country:
        pickRaw(raw, "country", "Country") ||
        (locationParts.length > 1 ? locationParts[locationParts.length - 1] : locationParts[0] || ""),
      state:
        pickRaw(raw, "state", "State", "province", "Province") ||
        (locationParts.length > 1 ? locationParts[0] : ""),
      mobile: phone,
      bio: pickRaw(raw, "bio", "Bio", "about", "About"),
      skills: pickRaw(raw, "skills", "Skills"),
      linkedin: pickRaw(raw, "linkedin", "LinkedIn", "linkedinUrl", "linkedin_url"),
      github: pickRaw(raw, "github", "GitHub", "githubUrl", "github_url"),
    });

    const image =
      profile?.profileImageUrl ||
      me.profileImage ||
      resolveUserAvatarUrl(profile?.userId || me.userId, null);
    setAvatarUrl(image || null);
    setLastLoginLabel(formatLastLogin(session));
    setStatusLabel(
      pickRaw(raw, "status", "Status", "accountStatus") || "Active"
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        applyProfile(getProfileFromSession());
        const profile = await getSoftOnCloudProfile();
        if (!cancelled && profile) applyProfile(profile);
      } catch (err) {
        if (!cancelled) {
          applyProfile(getProfileFromSession());
          setError(formatProfileApiError(err, "GET /api/profile"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyProfile]);

  const initials = useMemo(
    () => getInitials(form.username, form.email),
    [form.username, form.email]
  );

  const onFieldChange = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onAvatarPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\//i.test(file.type)) {
      setError("Please choose an image file.");
      return;
    }
    setPendingAvatarFile(file);
    setAvatarUrl(URL.createObjectURL(file));
    setSuccess("Picture will be saved when you click 'Save Changes'.");
    e.target.value = "";
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const username = String(form.username || "").trim();
    if (!username) {
      setError("Username is required.");
      return;
    }

    setSaving(true);
    try {
      if (pendingAvatarFile) {
        await updateSoftOnCloudProfileImage(pendingAvatarFile);
        setPendingAvatarFile(null);
      }

      const current = getProfileFromSession();
      const updated = await updateSoftOnCloudProfile({
        displayName: username,
        name: username,
        jobTitle: String(form.role || "").trim(),
        department: current?.department,
        // Keep existing phone — field is read-only in UI
        phone: current?.phone,
        phoneCountryCode: current?.phoneCountryCode,
      });

      applyProfile({
        ...updated,
        raw: {
          ...(updated.raw || {}),
          bio: form.bio,
          skills: form.skills,
          linkedin: form.linkedin,
          github: form.github,
          country: form.country,
          state: form.state,
          company: form.company,
        },
      });

      window.dispatchEvent(
        new CustomEvent("chat-profile-updated", {
          detail: { profile: updated },
        })
      );
      if (updated.profileImageUrl) {
        window.dispatchEvent(
          new CustomEvent("chat-profile-avatar-updated", {
            detail: {
              userId: String(updated.userId || getSessionUserIdentity().userId || ""),
              avatarUrl: updated.profileImageUrl,
            },
          })
        );
      }

      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(formatProfileApiError(err, "PUT /api/profile"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!newPassword || !confirmPassword) {
      setError("Enter new password and confirm password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setPasswordSaving(true);
    try {
      // SoftOnCloud uses OTP forgot-password flow (no in-session change-password API).
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(
        "To reset your password, use Forgot Password (OTP verification)."
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  document.title = "My Profile | Chat SoftOnCloud";

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="My Profile" pageTitle="Account" />

          {error ? <Alert color="danger">{error}</Alert> : null}
          {success ? <Alert color="success">{success}</Alert> : null}

          {loading ? (
            <div className="text-center py-5">
              <Spinner color="primary" />
            </div>
          ) : (
            <Row>
              <Col xl={8}>
                <Card>
                  <CardHeader>
                    <h4 className="card-title mb-0">Profile Details</h4>
                  </CardHeader>
                  <CardBody>
                    <Form onSubmit={handleSaveProfile}>
                      <Row>
                        <Col md={6}>
                          <div className="mb-3">
                            <Label htmlFor="profile-username" className="form-label">
                              Username
                            </Label>
                            <Input
                              id="profile-username"
                              type="text"
                              value={form.username}
                              onChange={onFieldChange("username")}
                              placeholder="Username"
                            />
                          </div>
                        </Col>
                        <Col md={6}>
                          <div className="mb-3">
                            <Label htmlFor="profile-email" className="form-label">
                              Email
                            </Label>
                            <Input
                              id="profile-email"
                              type="email"
                              value={form.email}
                              readOnly
                              plaintext={false}
                              className="bg-light"
                              title="Email cannot be edited"
                            />
                          </div>
                        </Col>
                        <Col md={6}>
                          <div className="mb-3">
                            <Label htmlFor="profile-company" className="form-label">
                              Company
                            </Label>
                            <Input
                              id="profile-company"
                              type="text"
                              value={form.company}
                              onChange={onFieldChange("company")}
                              placeholder="Company"
                            />
                          </div>
                        </Col>
                        <Col md={6}>
                          <div className="mb-3">
                            <Label htmlFor="profile-role" className="form-label">
                              Role
                            </Label>
                            <Input
                              id="profile-role"
                              type="text"
                              value={form.role}
                              onChange={onFieldChange("role")}
                              placeholder="Role"
                            />
                          </div>
                        </Col>
                        <Col md={6}>
                          <div className="mb-3">
                            <Label htmlFor="profile-country" className="form-label">
                              Country
                            </Label>
                            <Input
                              id="profile-country"
                              type="text"
                              value={form.country}
                              onChange={onFieldChange("country")}
                              placeholder="Country"
                            />
                          </div>
                        </Col>
                        <Col md={6}>
                          <div className="mb-3">
                            <Label htmlFor="profile-state" className="form-label">
                              State
                            </Label>
                            <Input
                              id="profile-state"
                              type="text"
                              value={form.state}
                              onChange={onFieldChange("state")}
                              placeholder="State"
                            />
                          </div>
                        </Col>
                        <Col md={6}>
                          <div className="mb-3">
                            <Label htmlFor="profile-mobile" className="form-label">
                              Mobile
                            </Label>
                            <Input
                              id="profile-mobile"
                              type="text"
                              value={form.mobile}
                              readOnly
                              className="bg-light"
                              title="Mobile cannot be edited"
                            />
                          </div>
                        </Col>
                        <Col md={12}>
                          <div className="mb-3">
                            <Label htmlFor="profile-bio" className="form-label">
                              Bio
                            </Label>
                            <Input
                              id="profile-bio"
                              type="textarea"
                              rows="3"
                              value={form.bio}
                              onChange={onFieldChange("bio")}
                              placeholder="Tell something about yourself"
                            />
                          </div>
                        </Col>
                        <Col md={12}>
                          <div className="mb-3">
                            <Label htmlFor="profile-skills" className="form-label">
                              Skills
                            </Label>
                            <Input
                              id="profile-skills"
                              type="textarea"
                              rows="2"
                              value={form.skills}
                              onChange={onFieldChange("skills")}
                              placeholder="e.g. C#, SQL, React"
                            />
                          </div>
                        </Col>
                        <Col md={6}>
                          <div className="mb-3">
                            <Label htmlFor="profile-linkedin" className="form-label">
                              Linkedin Profile
                            </Label>
                            <Input
                              id="profile-linkedin"
                              type="url"
                              value={form.linkedin}
                              onChange={onFieldChange("linkedin")}
                              placeholder="https://linkedin.com/in/..."
                            />
                          </div>
                        </Col>
                        <Col md={6}>
                          <div className="mb-3">
                            <Label htmlFor="profile-github" className="form-label">
                              GitHub Profile
                            </Label>
                            <Input
                              id="profile-github"
                              type="url"
                              value={form.github}
                              onChange={onFieldChange("github")}
                              placeholder="https://github.com/..."
                            />
                          </div>
                        </Col>
                      </Row>
                      <div className="text-end">
                        <Button color="primary" type="submit" disabled={saving}>
                          {saving ? (
                            <>
                              <Spinner size="sm" className="me-1" /> Saving…
                            </>
                          ) : (
                            "Save Changes"
                          )}
                        </Button>
                      </div>
                    </Form>
                  </CardBody>
                </Card>
              </Col>

              <Col xl={4}>
                <Card>
                  <CardBody className="text-center">
                    <div className="profile-user position-relative d-inline-block mb-3">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Profile"
                          className="rounded-circle avatar-xl img-thumbnail user-profile-image"
                          style={{ objectFit: "cover", width: 96, height: 96 }}
                        />
                      ) : (
                        <div
                          className="avatar-xl rounded-circle mx-auto"
                          style={{ width: 96, height: 96 }}
                        >
                          <span
                            className="avatar-title rounded-circle bg-primary-subtle text-primary fs-2"
                            style={{ width: 96, height: 96 }}
                          >
                            {initials}
                          </span>
                        </div>
                      )}
                      <div className="avatar-xs p-0 rounded-circle profile-photo-edit">
                        <Input
                          id="profile-img-file-input"
                          type="file"
                          className="profile-img-file-input d-none"
                          accept="image/*"
                          innerRef={fileInputRef}
                          onChange={onAvatarPick}
                        />
                        <Label
                          htmlFor="profile-img-file-input"
                          className="profile-photo-edit avatar-xs mb-0"
                          style={{ cursor: "pointer" }}
                        >
                          <span className="avatar-title rounded-circle bg-light text-body">
                            <i className="ri-pencil-fill"></i>
                          </span>
                        </Label>
                      </div>
                    </div>
                    <h5 className="fs-16 mb-1">{form.username || "User"}</h5>
                    <p className="text-muted mb-2">{form.role || "Employee"}</p>
                    {lastLoginLabel ? (
                      <p className="text-muted fs-12 mb-2">
                        Last login: {lastLoginLabel}
                      </p>
                    ) : null}
                    <span className="badge bg-success-subtle text-success">
                      {statusLabel}
                    </span>
                    {pendingAvatarFile ? (
                      <p className="text-muted fs-12 mt-3 mb-0">
                        Picture will be saved when you click &apos;Save Changes&apos;.
                      </p>
                    ) : null}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <h4 className="card-title mb-0">Reset Password</h4>
                  </CardHeader>
                  <CardBody>
                    <Form onSubmit={handleUpdatePassword}>
                      <div className="mb-3">
                        <Label htmlFor="profile-new-password" className="form-label">
                          New Password
                        </Label>
                        <Input
                          id="profile-new-password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="mb-3">
                        <Label htmlFor="profile-confirm-password" className="form-label">
                          Confirm Password
                        </Label>
                        <Input
                          id="profile-confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        <Button
                          color="light"
                          type="submit"
                          className="border"
                          disabled={passwordSaving}
                        >
                          {passwordSaving ? "Please wait…" : "Update Password"}
                        </Button>
                        <Link
                          to="/forgot-password"
                          className="btn btn-link btn-sm align-self-center"
                        >
                          Forgot Password?
                        </Link>
                      </div>
                    </Form>
                  </CardBody>
                </Card>
              </Col>
            </Row>
          )}
        </Container>
      </div>
    </React.Fragment>
  );
};

export default UserProfile;
