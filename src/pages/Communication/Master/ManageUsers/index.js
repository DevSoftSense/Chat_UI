import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Container,
  Form,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
  Spinner,
  Table,
} from "reactstrap";
import BreadCrumb from "../../../../Components/Common/BreadCrumb";
import {
  getSessionUserIdentity,
  resolveUserAvatarUrl,
} from "../../../../helpers/softoncloud_auth_helper";
import {
  assignProductRole,
  createProductSubUser,
  deleteProductSubUser,
  listProductRoles,
  listProductUsers,
  restrictProductSubUser,
  unrestrictProductSubUser,
  updateProductSubUser,
} from "../../../../helpers/softoncloud_master_helper";

const emptyForm = () => ({
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  phone_country_code: "+91",
  job_title: "",
  department: "",
  role_id: "",
  is_active: true,
});

const pick = (row, ...keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value != null && String(value).trim() !== "") return value;
  }
  return "";
};

const normalizeUser = (row) => {
  const publicUserId = String(
    pick(row, "publicUserId", "PublicUserId", "public_user_id") || ""
  );
  const userId = String(pick(row, "userId", "UserId", "id", "Id") || "");
  const firstName = pick(row, "firstName", "FirstName", "first_name");
  const lastName = pick(row, "lastName", "LastName", "last_name");
  const displayName =
    pick(row, "displayName", "DisplayName", "name", "Name", "fullName") ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    pick(row, "email", "Email") ||
    "User";
  const roleIds = row?.roleIds ?? row?.RoleIds ?? [];
  const roleNames = row?.roleNames ?? row?.RoleNames ?? [];
  const roleCodes = row?.roleCodes ?? row?.RoleCodes ?? [];
  const roleId =
    pick(row, "roleId", "RoleId", "role_id") ||
    (Array.isArray(roleIds) && roleIds[0]) ||
    "";
  const roleName =
    pick(row, "roleName", "RoleName") ||
    (Array.isArray(roleNames) && roleNames[0]) ||
    "";
  const roleCode =
    pick(row, "roleCode", "RoleCode") ||
    (Array.isArray(roleCodes) && roleCodes[0]) ||
    "";
  const avatar = pick(
    row,
    "profileImageUrl",
    "ProfileImageUrl",
    "photoUrl",
    "avatarUrl"
  );
  const isActive = row?.isActive ?? row?.IsActive ?? row?.is_active;
  const isRestricted =
    row?.isRestricted ?? row?.IsRestricted ?? row?.is_restricted ?? false;

  return {
    publicUserId,
    userId,
    email: pick(row, "email", "Email"),
    firstName,
    lastName,
    displayName,
    phone: pick(row, "phone", "Phone"),
    phoneCountryCode: pick(
      row,
      "phoneCountryCode",
      "PhoneCountryCode",
      "phone_country_code"
    ),
    jobTitle: pick(row, "jobTitle", "JobTitle", "job_title"),
    department: pick(row, "department", "Department"),
    roleId: roleId === "" ? "" : String(roleId),
    roleName,
    roleCode,
    isActive: isActive !== false && isActive !== 0,
    isRestricted: Boolean(isRestricted),
    avatar: resolveUserAvatarUrl(userId || publicUserId, avatar || null),
  };
};

const ManageUsers = () => {
  document.title = "Manage Users | Chat SoftOnCloud";

  const me = useMemo(() => getSessionUserIdentity(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userRows, roleRows] = await Promise.all([
        listProductUsers(),
        listProductRoles(false),
      ]);
      setUsers((userRows || []).map(normalizeUser));
      setRoles(
        (roleRows || []).map((r) => ({
          roleId: String(r.roleId ?? r.RoleId ?? ""),
          roleName: r.roleName ?? r.RoleName ?? "",
          roleCode: r.roleCode ?? r.RoleCode ?? "",
          status: String(r.status ?? r.Status ?? "active").toLowerCase(),
        }))
      );
    } catch (err) {
      setError(err?.message || "Failed to load users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.displayName, u.email, u.roleName, u.department, u.jobTitle]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [users, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      role_id: roles[0]?.roleId || "",
    });
    setModalOpen(true);
    setSuccess(null);
    setError(null);
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      email: user.email,
      first_name: user.firstName || user.displayName.split(" ")[0] || "",
      last_name:
        user.lastName || user.displayName.split(" ").slice(1).join(" ") || "",
      phone: user.phone || "",
      phone_country_code: user.phoneCountryCode || "+91",
      job_title: user.jobTitle || "",
      department: user.department || "",
      role_id: user.roleId || roles[0]?.roleId || "",
      is_active: user.isActive,
    });
    setModalOpen(true);
    setSuccess(null);
    setError(null);
  };

  const onChange = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onSave = async (e) => {
    e.preventDefault();
    if (!form.first_name?.trim() || !form.role_id) {
      setError("First name and role are required.");
      return;
    }
    if (!editing && !form.email?.trim()) {
      setError("Email is required to invite a user.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editing?.publicUserId) {
        await updateProductSubUser(editing.publicUserId, {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || null,
          phone: form.phone.trim() || null,
          phone_country_code: form.phone_country_code.trim() || null,
          job_title: form.job_title.trim() || null,
          department: form.department.trim() || null,
          role_id: Number(form.role_id),
          is_active: Boolean(form.is_active),
        });
        if (
          form.role_id &&
          String(form.role_id) !== String(editing.roleId || "")
        ) {
          await assignProductRole(editing.publicUserId, Number(form.role_id));
        }
        setSuccess("User updated.");
      } else {
        await createProductSubUser({
          email: form.email.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || null,
          phone: form.phone.trim() || null,
          phone_country_code: form.phone_country_code.trim() || null,
          job_title: form.job_title.trim() || null,
          department: form.department.trim() || null,
          role_id: Number(form.role_id),
        });
        setSuccess("User invited / created.");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const onToggleRestrict = async (user) => {
    if (!user.publicUserId) {
      setError("publicUserId missing — cannot restrict this user.");
      return;
    }
    if (String(user.userId) === String(me?.userId || "")) {
      setError("You cannot restrict your own account.");
      return;
    }
    setError(null);
    try {
      if (user.isRestricted) {
        await unrestrictProductSubUser(user.publicUserId);
        setSuccess("User unrestricted.");
      } else {
        await restrictProductSubUser(user.publicUserId);
        setSuccess("User restricted.");
      }
      await load();
    } catch (err) {
      setError(err?.message || "Restrict action failed.");
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget?.publicUserId) return;
    setSaving(true);
    setError(null);
    try {
      await deleteProductSubUser(deleteTarget.publicUserId);
      setSuccess("User removed from this app.");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err?.message || "Delete failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Manage Users" pageTitle="Master" />

        {error && (
          <Alert color="danger" toggle={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert color="success" toggle={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <Card>
          <CardBody>
            <Row className="g-3 align-items-center mb-3">
              <Col md={6}>
                <Input
                  type="search"
                  placeholder="Search users…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Col>
              <Col md={6} className="text-md-end d-flex gap-2 justify-content-md-end">
                <Button color="soft-primary" onClick={load} disabled={loading}>
                  <i className="ri-refresh-line me-1" />
                  Refresh
                </Button>
                <Button color="primary" onClick={openCreate}>
                  <i className="ri-user-add-line me-1" />
                  Invite User
                </Button>
              </Col>
            </Row>

            {loading ? (
              <div className="text-center py-5">
                <Spinner color="primary" />
              </div>
            ) : (
              <div className="table-responsive">
                <Table className="align-middle table-nowrap mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          No users found for this app.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((user, index) => (
                        <tr key={user.publicUserId || user.userId || index}>
                          <td>{index + 1}</td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              {user.avatar ? (
                                <img
                                  src={user.avatar}
                                  alt=""
                                  className="rounded-circle avatar-xs"
                                />
                              ) : (
                                <span className="avatar-xs">
                                  <span className="avatar-title rounded-circle bg-primary-subtle text-primary">
                                    {(user.displayName || "?").charAt(0)}
                                  </span>
                                </span>
                              )}
                              <div>
                                <div className="fw-medium">{user.displayName}</div>
                                <small className="text-muted">
                                  {[user.jobTitle, user.department]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>{user.email || "—"}</td>
                          <td>
                            {user.roleName || user.roleCode || (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              <Badge color={user.isActive ? "success" : "secondary"}>
                                {user.isActive ? "Active" : "Inactive"}
                              </Badge>
                              {user.isRestricted && (
                                <Badge color="warning">Restricted</Badge>
                              )}
                            </div>
                          </td>
                          <td className="text-end">
                            <div className="d-inline-flex gap-1">
                              <Button
                                size="sm"
                                color="soft-primary"
                                onClick={() => openEdit(user)}
                                disabled={!user.publicUserId}
                                title="Edit"
                              >
                                <i className="ri-pencil-line" />
                              </Button>
                              <Button
                                size="sm"
                                color={
                                  user.isRestricted ? "soft-success" : "soft-warning"
                                }
                                onClick={() => onToggleRestrict(user)}
                                disabled={!user.publicUserId || !user.isActive}
                                title={
                                  user.isRestricted ? "Unrestrict" : "Restrict"
                                }
                              >
                                <i
                                  className={
                                    user.isRestricted
                                      ? "ri-lock-unlock-line"
                                      : "ri-lock-line"
                                  }
                                />
                              </Button>
                              <Button
                                size="sm"
                                color="soft-danger"
                                onClick={() => setDeleteTarget(user)}
                                disabled={
                                  !user.publicUserId ||
                                  String(user.userId) === String(me?.userId || "")
                                }
                                title="Remove"
                              >
                                <i className="ri-delete-bin-line" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>

        <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)} centered>
          <Form onSubmit={onSave}>
            <ModalHeader toggle={() => setModalOpen(false)}>
              {editing ? "Edit User" : "Invite User"}
            </ModalHeader>
            <ModalBody>
              {!editing && (
                <FormGroup>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    required
                    value={form.email}
                    onChange={onChange("email")}
                  />
                </FormGroup>
              )}
              <Row>
                <Col md={6}>
                  <FormGroup>
                    <Label>First name</Label>
                    <Input
                      required
                      value={form.first_name}
                      onChange={onChange("first_name")}
                    />
                  </FormGroup>
                </Col>
                <Col md={6}>
                  <FormGroup>
                    <Label>Last name</Label>
                    <Input
                      value={form.last_name}
                      onChange={onChange("last_name")}
                    />
                  </FormGroup>
                </Col>
              </Row>
              <Row>
                <Col md={4}>
                  <FormGroup>
                    <Label>Dial code</Label>
                    <Input
                      value={form.phone_country_code}
                      onChange={onChange("phone_country_code")}
                    />
                  </FormGroup>
                </Col>
                <Col md={8}>
                  <FormGroup>
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={onChange("phone")} />
                  </FormGroup>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <FormGroup>
                    <Label>Job title</Label>
                    <Input
                      value={form.job_title}
                      onChange={onChange("job_title")}
                    />
                  </FormGroup>
                </Col>
                <Col md={6}>
                  <FormGroup>
                    <Label>Department</Label>
                    <Input
                      value={form.department}
                      onChange={onChange("department")}
                    />
                  </FormGroup>
                </Col>
              </Row>
              <FormGroup>
                <Label>Role</Label>
                <Input
                  type="select"
                  required
                  value={form.role_id}
                  onChange={onChange("role_id")}
                >
                  <option value="">Select role</option>
                  {roles.map((r) => (
                    <option key={r.roleId} value={r.roleId}>
                      {r.roleName || r.roleCode}
                    </option>
                  ))}
                </Input>
              </FormGroup>
              {editing && (
                <FormGroup check>
                  <Input
                    type="checkbox"
                    id="userIsActive"
                    checked={form.is_active}
                    onChange={onChange("is_active")}
                  />
                  <Label check htmlFor="userIsActive" className="ms-1">
                    Active
                  </Label>
                </FormGroup>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                color="light"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button color="primary" type="submit" disabled={saving}>
                {saving ? <Spinner size="sm" /> : editing ? "Update" : "Invite"}
              </Button>
            </ModalFooter>
          </Form>
        </Modal>

        <Modal
          isOpen={Boolean(deleteTarget)}
          toggle={() => setDeleteTarget(null)}
          centered
        >
          <ModalHeader toggle={() => setDeleteTarget(null)}>
            Remove user
          </ModalHeader>
          <ModalBody>
            Remove <strong>{deleteTarget?.displayName}</strong> from this app?
          </ModalBody>
          <ModalFooter>
            <Button color="light" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button color="danger" onClick={onConfirmDelete} disabled={saving}>
              {saving ? <Spinner size="sm" /> : "Remove"}
            </Button>
          </ModalFooter>
        </Modal>
      </Container>
    </div>
  );
};

export default ManageUsers;
