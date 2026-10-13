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
  createProductRole,
  getSessionProductCode,
  listProductRoles,
  manageProductRole,
} from "../../../../helpers/softoncloud_master_helper";

const emptyForm = () => ({
  role_code_suffix: "",
  role_name: "",
  description: "",
});

const ManageRoles = () => {
  document.title = "Manage Roles | Chat SoftOnCloud";

  const productCode = useMemo(() => getSessionProductCode(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listProductRoles(true);
      setRoles(
        (rows || []).map((r) => ({
          roleId: r.roleId ?? r.RoleId,
          roleCode: r.roleCode ?? r.RoleCode ?? "",
          roleName: r.roleName ?? r.RoleName ?? "",
          description: r.description ?? r.Description ?? "",
          status: String(r.status ?? r.Status ?? "active").toLowerCase(),
          productId: r.productId ?? r.ProductId,
        }))
      );
    } catch (err) {
      setError(err?.message || "Failed to load roles.");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) =>
      [r.roleName, r.roleCode, r.description, r.status]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [roles, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
    setError(null);
    setSuccess(null);
  };

  const openEdit = (role) => {
    setEditing(role);
    setForm({
      role_code_suffix: "",
      role_name: role.roleName || "",
      description: role.description || "",
    });
    setModalOpen(true);
    setError(null);
    setSuccess(null);
  };

  const onChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const builtRoleCode = () => {
    const suffix = String(form.role_code_suffix || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "");
    if (!suffix) return "";
    return `${productCode}_${suffix}`;
  };

  const onSave = async (e) => {
    e.preventDefault();
    if (!form.role_name.trim()) {
      setError("Role name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editing) {
        await manageProductRole(editing.roleId, {
          action: "update",
          role_name: form.role_name.trim(),
          description: form.description.trim() || null,
        });
        setSuccess("Role updated.");
      } else {
        const roleCode = builtRoleCode();
        if (!roleCode || !/^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/.test(roleCode)) {
          setError(
            `Role code must look like ${productCode}_MANAGER (letters/numbers/underscore).`
          );
          setSaving(false);
          return;
        }
        await createProductRole({
          roleCode,
          roleName: form.role_name.trim(),
          description: form.description.trim() || null,
        });
        setSuccess("Role created.");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const formatRoleActionError = (err, action) => {
    const msg = String(err?.message || err?.data?.message || "");
    if (/not a product admin/i.test(msg)) {
      return (
        `Cannot ${action} this role: your SoftOnCloud user is not a Product Admin ` +
        `for this organisation and Chat product. Ask a SoftOnCloud admin to grant Product Admin, then try again.`
      );
    }
    return msg || `${action} failed.`;
  };

  const onAction = async (role, action) => {
    setError(null);
    setSuccess(null);
    try {
      await manageProductRole(role.roleId, { action });
      setSuccess(
        action === "activate"
          ? "Role activated."
          : action === "deactivate"
            ? "Role deactivated."
            : "Role deleted."
      );
      await load();
    } catch (err) {
      setError(formatRoleActionError(err, action));
    }
  };

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Manage Roles" pageTitle="Master" />

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
                  placeholder="Search roles…"
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
                  <i className="ri-add-line me-1" />
                  Create Role
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
                      <th>Role name</th>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          No roles found for this app.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((role, index) => (
                        <tr key={role.roleId || index}>
                          <td>{index + 1}</td>
                          <td className="fw-medium">{role.roleName}</td>
                          <td>
                            <code>{role.roleCode}</code>
                          </td>
                          <td className="text-muted">
                            {role.description || "—"}
                          </td>
                          <td>
                            <Badge
                              color={
                                role.status === "active" ? "success" : "secondary"
                              }
                            >
                              {role.status || "active"}
                            </Badge>
                          </td>
                          <td className="text-end">
                            <div className="d-inline-flex gap-1">
                              <Button
                                size="sm"
                                color="soft-primary"
                                onClick={() => openEdit(role)}
                                title="Edit"
                              >
                                <i className="ri-pencil-line" />
                              </Button>
                              {role.status === "active" ? (
                                <Button
                                  size="sm"
                                  color="soft-warning"
                                  onClick={() => onAction(role, "deactivate")}
                                  title="Deactivate"
                                >
                                  <i className="ri-pause-circle-line" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  color="soft-success"
                                  onClick={() => onAction(role, "activate")}
                                  title="Activate"
                                >
                                  <i className="ri-play-circle-line" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                color="soft-danger"
                                onClick={() => onAction(role, "delete")}
                                title="Delete"
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
              {editing ? "Edit Role" : "Create Role"}
            </ModalHeader>
            <ModalBody>
              {!editing && (
                <FormGroup>
                  <Label>Role code</Label>
                  <div className="input-group">
                    <span className="input-group-text">{productCode}_</span>
                    <Input
                      required
                      placeholder="MANAGER"
                      value={form.role_code_suffix}
                      onChange={onChange("role_code_suffix")}
                    />
                  </div>
                  <small className="text-muted">
                    SoftOnCloud requires{" "}
                    <code>
                      {productCode}_…
                    </code>{" "}
                    for this app. Preview:{" "}
                    <code>{builtRoleCode() || `${productCode}_…`}</code>
                  </small>
                </FormGroup>
              )}
              {editing && (
                <FormGroup>
                  <Label>Role code</Label>
                  <Input value={editing.roleCode} disabled />
                </FormGroup>
              )}
              <FormGroup>
                <Label>Role name</Label>
                <Input
                  required
                  value={form.role_name}
                  onChange={onChange("role_name")}
                />
              </FormGroup>
              <FormGroup>
                <Label>Description</Label>
                <Input
                  type="textarea"
                  rows={3}
                  value={form.description}
                  onChange={onChange("description")}
                />
              </FormGroup>
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
                {saving ? <Spinner size="sm" /> : editing ? "Update" : "Create"}
              </Button>
            </ModalFooter>
          </Form>
        </Modal>
      </Container>
    </div>
  );
};

export default ManageRoles;
